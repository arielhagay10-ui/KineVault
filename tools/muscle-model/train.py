"""Train a participant-held-out motion-to-EMG prototype on real ULTRA-MoCap trials."""

import argparse
import copy
import json
import os
import random
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
from data import (
    CHANNELS,
    FEATURES,
    JOINTS,
    MUSCLES,
    SAMPLE_RATE,
    MotionWindows,
    fit_normalization,
    read_trials,
)
from fetch import DEFAULT_OUTPUT, DOI, digest
from model import LinearBaseline, MuscleModel
from torch import nn
from torch.utils.data import DataLoader

SPLITS = {
    "train": [f"subject_{index}" for index in range(1, 10)],
    "validation": ["subject_10", "subject_11"],
    "held_out": ["subject_12", "subject_13"],
}


def measure(model, loader, target_mean, target_scale):
    if model is not None:
        model.eval()
    absolute = torch.zeros(len(MUSCLES), dtype=torch.float64)
    squared = torch.zeros_like(absolute)
    total = torch.zeros_like(absolute)
    total_squared = torch.zeros_like(absolute)
    count = 0
    with torch.inference_mode():
        for motion, target in loader:
            prediction = (
                model(motion).clamp_min(0)
                if model is not None
                else target_mean.expand_as(target)
            )
            difference = (prediction - target).double()
            absolute += difference.abs().sum(dim=(0, 1))
            squared += (difference**2).sum(dim=(0, 1))
            total += target.double().sum(dim=(0, 1))
            total_squared += (target.double() ** 2).sum(dim=(0, 1))
            count += target.shape[0] * target.shape[1]
    if not count:
        raise ValueError("Cannot evaluate an empty split.")
    mae = absolute.numpy() / count
    mse = squared.numpy() / count
    variance_sum = total_squared.numpy() - total.numpy() ** 2 / count
    return {
        "mse": float(mse.mean()),
        "macro_mae": float(mae.mean()),
        "samples": count,
        "muscles": {
            muscle: {
                "mae_training_scale": float(mae[index]),
                "mae_microvolts": float(mae[index] * target_scale[index] * 1e6),
                "r_squared": float(1 - squared[index].item() / variance_sum[index])
                if variance_sum[index] > 1e-12
                else None,
            }
            for index, muscle in enumerate(MUSCLES)
        },
    }


def fit(model, loaders, normalization, epochs, patience, learning_rate):
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=learning_rate, weight_decay=0.01
    )
    criterion = nn.MSELoss()
    best_loss = float("inf")
    best_state = None
    history = []
    stale = 0
    target_mean = torch.tensor(normalization["target_mean"], dtype=torch.float32)
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        count = 0
        for motion, target in loaders["train"]:
            optimizer.zero_grad(set_to_none=True)
            prediction = model(motion)
            loss = criterion(prediction, target)
            if not torch.isfinite(loss):
                raise ValueError("Training diverged to a non-finite loss.")
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item() * len(motion)
            count += len(motion)
        validation = measure(
            model, loaders["validation"], target_mean, normalization["target_scale"]
        )
        history.append(
            {
                "epoch": epoch,
                "train_mse": train_loss / count,
                "validation_mse": validation["mse"],
            }
        )
        print(
            f"epoch={epoch:02d} train_mse={train_loss / count:.5f} validation_mse={validation['mse']:.5f}",
            flush=True,
        )
        if validation["mse"] < best_loss - 1e-6:
            best_loss = validation["mse"]
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                break
    if best_state is None:
        raise ValueError("No finite validation checkpoint was produced.")
    model.load_state_dict(best_state)
    return history


def train(args):
    if (
        args.epochs < 1
        or args.patience < 1
        or args.batch_size < 1
        or args.learning_rate <= 0
        or args.threads < 1
    ):
        raise ValueError(
            "Epochs, patience, batch size, learning rate, and threads must be positive."
        )
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError(
            "Choose an empty output directory to preserve existing checkpoints."
        )
    provenance_path = args.data.parent / "source.json"
    provenance = json.loads(provenance_path.read_text(encoding="utf-8-sig"))
    if (
        provenance.get("doi") != DOI
        or provenance.get("license", {}).get("name") != "CC BY 4.0"
    ):
        raise ValueError(
            "Run fetch.py to record the verified source and license first."
        )
    if digest(args.data, "sha256") != provenance.get("hdf5_sha256"):
        raise ValueError(
            "HDF5 differs from the verified import recorded in source.json."
        )
    torch.set_num_threads(args.threads)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.use_deterministic_algorithms(True)
    trials = read_trials(args.data)
    participants = {trial.subject for trial in trials}
    expected = set().union(*map(set, SPLITS.values()))
    if participants != expected:
        raise ValueError(
            f"Expected the published 13-participant release; found {sorted(participants)}."
        )
    groups = {
        name: [trial for trial in trials if trial.subject in subjects]
        for name, subjects in SPLITS.items()
    }
    normalization = fit_normalization(groups["train"])
    windows = {
        name: MotionWindows(
            group,
            normalization,
            window=args.window,
            stride=32 if name == "train" else args.window,
        )
        for name, group in groups.items()
    }
    loaders = {
        name: DataLoader(
            dataset,
            batch_size=args.batch_size,
            shuffle=name == "train",
            num_workers=0,
            generator=torch.Generator().manual_seed(args.seed),
        )
        for name, dataset in windows.items()
    }
    args.output.mkdir(parents=True, exist_ok=True)
    metadata = {
        "schema_version": 1,
        "joint_columns": JOINTS,
        "feature_columns": FEATURES,
        "muscles": MUSCLES,
        "emg_channels": CHANNELS,
        "sample_rate_hz": SAMPLE_RATE,
        "window_frames": args.window,
        "normalization": normalization,
        "splits": SPLITS,
        "source": provenance,
        "target": "100 Hz published EMG, 5-45 Hz bandpass, 210 ms RMS, divided by training-only muscle P95; not MVC or activation probability",
        "filter_edge_trim_frames": 64,
        "seed": args.seed,
        "torch_version": str(torch.__version__),
    }
    target_mean = torch.tensor(normalization["target_mean"], dtype=torch.float32)
    constant = measure(
        None, loaders["held_out"], target_mean, normalization["target_scale"]
    )
    report = {
        "created_at": datetime.now(UTC).isoformat(),
        "configuration": {
            key: str(value) if isinstance(value, Path) else value
            for key, value in vars(args).items()
        },
        "splits": {
            name: {
                "participants": SPLITS[name],
                "trials": len(group),
                "windows": len(windows[name]),
            }
            for name, group in groups.items()
        },
        "source_padding_rows_removed": sum(trial.padding_rows for trial in trials),
        "constant_baseline_held_out": constant,
        "models": {},
        "limitations": [
            "Processed EMG was downsampled from 2000 Hz to 100 Hz upstream; lost bandwidth cannot be recovered.",
            "Only three right-arm muscles and five unloaded upper-limb tasks; no external force inputs are supplied.",
            "Held-out participants perform known task types; this does not establish unseen-exercise generalization.",
            "Signal magnitude estimates are not muscle force, physiological activation percentages, or reviewed binary involvement.",
            "Global training-only scaling preserves held-out isolation but does not correct participant electrode/skin differences.",
        ],
    }
    for name, model in [
        ("linear", LinearBaseline(len(FEATURES))),
        ("temporal", MuscleModel(len(FEATURES))),
    ]:
        print(f"Training {name} on {len(windows['train'])} motion windows", flush=True)
        history = fit(
            model,
            loaders,
            normalization,
            args.epochs,
            args.patience,
            args.learning_rate,
        )
        validation = measure(
            model, loaders["validation"], target_mean, normalization["target_scale"]
        )
        held_out = measure(
            model, loaders["held_out"], target_mean, normalization["target_scale"]
        )
        checkpoint = {
            **metadata,
            "model_type": name,
            "model_state_dict": model.state_dict(),
        }
        torch.save(checkpoint, args.output / f"{name}.pt")
        report["models"][name] = {
            "parameters": sum(parameter.numel() for parameter in model.parameters()),
            "validation": validation,
            "held_out": held_out,
            "history": history,
        }
        (args.output / "report.json").write_text(
            json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8"
        )
        print(
            f"{name} held-out MAE={held_out['macro_mae']:.5f}; constant baseline={constant['macro_mae']:.5f}",
            flush=True,
        )
    print(f"Saved models and report: {args.output}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data", type=Path, default=DEFAULT_OUTPUT / "All_subjects_data.h5"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT
        / "runs"
        / datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ"),
    )
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--window", type=int, default=64)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--threads", type=int, default=min(4, os.cpu_count() or 1))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    try:
        train(args)
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        parser.exit(1, f"Training failed: {error}\n")
