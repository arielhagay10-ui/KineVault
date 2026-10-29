"""Predict low-rate EMG magnitude from explicitly ordered joint-angle samples."""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from data import FEATURES, JOINTS, MUSCLES, SAMPLE_RATE, motion_features
from model import LinearBaseline, MuscleModel


def predict(checkpoint_path: Path, input_path: Path, output_path: Path):
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    if (
        checkpoint.get("schema_version") != 1
        or checkpoint.get("joint_columns") != JOINTS
        or checkpoint.get("feature_columns") != FEATURES
        or checkpoint.get("muscles") != MUSCLES
        or checkpoint.get("sample_rate_hz") != SAMPLE_RATE
    ):
        raise ValueError("Checkpoint schema or coordinate contract is incompatible.")
    source = json.loads(input_path.read_text(encoding="utf-8-sig"))
    if source.get("joint_columns") != JOINTS:
        raise ValueError(
            f"Input must provide the exact ordered OpenSim degree columns: {JOINTS}"
        )
    features = motion_features(
        np.asarray(source["time_seconds"]), np.asarray(source["angles_degrees"])
    )
    normalization = checkpoint["normalization"]
    motion = (features - np.asarray(normalization["mean"])) / np.asarray(
        normalization["std"]
    )
    if not np.isfinite(motion).all():
        raise ValueError("Invalid normalization or motion input.")
    kind = checkpoint.get("model_type")
    if kind not in {"temporal", "linear"}:
        raise ValueError("Unknown checkpoint model type.")
    model = (
        MuscleModel(len(FEATURES))
        if kind == "temporal"
        else LinearBaseline(len(FEATURES))
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    torch.set_num_threads(2)
    with torch.inference_mode():
        normalized = (
            model(torch.tensor(motion, dtype=torch.float32).unsqueeze(0))
            .squeeze(0)
            .clamp_min(0)
            .numpy()
        )
    result = {
        "muscles": MUSCLES,
        "time_seconds": source["time_seconds"],
        "predicted_magnitude_volts": (
            normalized * np.asarray(normalization["target_scale"])
        ).tolist(),
        "predicted_magnitude_training_scale": normalized.tolist(),
        "target_description": checkpoint["target"],
        "source_doi": checkpoint["source"]["doi"],
        "edge_context_frames": 4,
        "scope": "Research estimate for ULTRA-MoCap-like movement; no binary labels or calibrated activation probabilities.",
    }
    if output_path.exists():
        raise ValueError("Choose a new output path to preserve existing predictions.")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    print(f"Saved {len(features)} predicted samples: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        predict(args.checkpoint, args.input, args.output)
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        parser.exit(1, f"Prediction failed: {error}\n")
