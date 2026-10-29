"""Reviewed exercise labels -> small, independent binary muscle classifiers."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from scipy.spatial.transform import Rotation
from torch import nn


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path, value):
    with Path(path).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write("\n")


def features(sample):
    """Describe recorded rig rotations, never anatomical actions or muscle labels."""
    scene = sample["scene"]
    if not scene or scene["motion_style"] != "free" or scene["studio_layout"]:
        raise ValueError(
            "Requires reviewed free motion; studio constraints need a solved-pose exporter"
        )
    frames = scene["frames"]
    time = np.asarray([frame["position_ms"] for frame in frames], dtype=float) / 1000
    if len(time) < 2 or not np.isfinite(time).all() or np.any(np.diff(time) <= 0):
        raise ValueError("Requires at least two distinct, ordered keyframes")
    if time[0] != 0 or time[-1] > scene["duration_ms"] / 1000:
        raise ValueError("Invalid scene time range")
    poses = []
    for frame in frames:
        joints = {}
        for pose in frame["motion_joint_poses"]:
            joint = pose["rig_joints"]["slug"]
            if joint in joints:
                raise ValueError("Duplicate joint in keyframe")
            quat = np.asarray(
                [pose[f"rotation_{axis}"] for axis in "xyzw"], dtype=float
            )
            if not np.isfinite(quat).all() or abs(np.linalg.norm(quat) - 1) > 0.01:
                raise ValueError("Invalid joint quaternion")
            joints[joint] = quat
        poses.append(joints)
    # Missing rotations are unknown here, rather than assumed neutral.
    joints = set(poses[0])
    if not joints or any(set(frame) != joints for frame in poses):
        raise ValueError("Inconsistent joint coverage; export complete poses first")
    values = {}
    moving = False
    for joint in sorted(joints):
        rotations = Rotation.from_quat(np.stack([frame[joint] for frame in poses]))
        relative = rotations[0].inv() * rotations
        vectors = relative.as_rotvec(degrees=True)
        moving |= bool(np.max(relative.magnitude()) > np.deg2rad(1))
        for field, vector in (
            ("start", rotations[0].as_rotvec(degrees=True)),
            ("end_delta", vectors[-1]),
            ("min_delta", vectors.min(axis=0)),
            ("max_delta", vectors.max(axis=0)),
        ):
            for axis, number in zip("xyz", vector, strict=True):
                values[f"rig:{joint}:{field}:{axis}"] = float(number)
        values[f"rig:{joint}:present"] = 1.0
    if not moving:
        raise ValueError("No recorded joint changes by more than one degree")
    setup = sample.get("setup") or {}
    source = setup.get("resistance_sources")
    if not source:
        raise ValueError("Missing resistance source")
    for field in ("body_positions", "grips", "stances", "resistance_sources"):
        values[f"setup:{field}:{(setup.get(field) or {}).get('slug', 'unknown')}"] = 1.0
    values[f"setup:resistance_profile:{setup.get('resistance_profile', 'unknown')}"] = (
        1.0
    )
    for item in sample["equipment"]:
        values[f"equipment:{item['role']}:{item['equipment']['slug']}"] = 1.0
    return values


def load_examples(catalog_path, reviews_path):
    catalog, reviews = read_json(catalog_path), read_json(reviews_path)
    if catalog["schema_version"] != 1 or reviews["schema_version"] != 1:
        raise ValueError("Unsupported dataset schema")
    muscles = catalog["muscles"]
    if not muscles or len(muscles) != len(set(muscles)):
        raise ValueError("Invalid muscle vocabulary")
    by_id = {item["content_id"]: item for item in reviews["reviews"]}
    if len(by_id) != len(reviews["reviews"]):
        raise ValueError("Duplicate reviews")
    identifiers = [item["content_id"] for item in catalog["examples"]]
    if len(identifiers) != len(set(identifiers)) or set(by_id) - set(identifiers):
        raise ValueError("Duplicate examples or reviews for absent content")
    examples, rejected = [], []
    for sample in catalog["examples"]:
        review = by_id.get(sample["content_id"], {})
        reasons = []
        if review.get("snapshot_sha256") != sample["snapshot_sha256"]:
            reasons.append("missing_or_stale_review")
        if (
            not isinstance(review.get("reviewer"), str)
            or not review["reviewer"].strip()
        ):
            reasons.append("missing_reviewer")
        evidence = review.get("evidence")
        if (
            not isinstance(evidence, list)
            or not evidence
            or any(not isinstance(item, str) or not item.strip() for item in evidence)
        ):
            reasons.append("missing_evidence")
        for flag in ("rights_confirmed", "motion_reviewed", "setup_reviewed"):
            if review.get(flag) is not True:
                reasons.append(flag)
        group = review.get("group_id")
        if not isinstance(group, str) or not group.strip():
            reasons.append("missing_family_group")
        elif sample["family_id"] and group != sample["family_id"]:
            reasons.append("family_group_mismatch")
        labels = review.get("labels", {})
        if not isinstance(labels, dict) or set(labels) - set(muscles):
            raise ValueError(
                f"Invalid muscle names in review for {sample['content_id']}"
            )
        if any(
            value is not None and (type(value) is not int or value not in (0, 1))
            for value in labels.values()
        ):
            raise ValueError("Muscle labels must be 0, 1 or null")
        if not any(value is not None for value in labels.values()):
            reasons.append("no_reviewed_binary_labels")
        try:
            values = features(sample)
        except (ValueError, KeyError, TypeError) as error:
            reasons.append(str(error))
            values = {}
        if reasons:
            rejected.append(
                {
                    "content_id": sample["content_id"],
                    "name": sample["name"],
                    "reasons": reasons,
                }
            )
        else:
            examples.append(
                {
                    "content_id": sample["content_id"],
                    "group": group,
                    "features": values,
                    "labels": [labels.get(muscle) for muscle in muscles],
                }
            )
    report = {
        "public_examples": len(catalog["examples"]),
        "eligible_examples": len(examples),
        "eligible_families": len({item["group"] for item in examples}),
        "excluded": rejected,
        "label_counts": {
            muscle: {
                str(label): sum(item["labels"][i] == label for item in examples)
                for label in (0, 1)
            }
            for i, muscle in enumerate(muscles)
        },
    }
    return examples, muscles, report


def metrics(probabilities, targets):
    known = targets >= 0
    predicted, positive = probabilities >= 0.5, targets == 1
    tp = (known & predicted & positive).sum(axis=0)
    fp = (known & predicted & ~positive).sum(axis=0)
    fn = (known & ~predicted & positive).sum(axis=0)
    precision = tp / np.maximum(tp + fp, 1)
    recall = tp / np.maximum(tp + fn, 1)
    f1 = 2 * tp / np.maximum(2 * tp + fp + fn, 1)
    positive_count = (known & positive).sum(axis=0)
    negative_count = (known & ~positive).sum(axis=0)
    assessable = (positive_count > 0) & (negative_count > 0)
    nullable = lambda values: [
        float(value) if valid else None
        for value, valid in zip(values, assessable, strict=True)
    ]
    return {
        "macro_f1": float(f1[assessable].mean()) if assessable.any() else None,
        "precision": nullable(precision),
        "recall": nullable(recall),
        "f1": nullable(f1),
        "positive_labels": positive_count.tolist(),
        "negative_labels": negative_count.tolist(),
    }


def train(examples, muscles, args, report):
    groups = sorted({item["group"] for item in examples})
    if len(groups) < 10:
        raise ValueError(
            f"Need at least 10 reviewed exercise families; found {len(groups)}"
        )
    # Family assignments are fixed before looking at labels. No automatic resplitting.
    np.random.default_rng(42).shuffle(groups)
    count = len(groups) // 5
    assignments = {
        "train": groups[2 * count :],
        "validation": groups[count : 2 * count],
        "held_out": groups[:count],
    }
    splits = {
        name: [item for item in examples if item["group"] in selected]
        for name, selected in assignments.items()
    }
    targets = {
        name: np.asarray(
            [
                [value if value is not None else -1 for value in item["labels"]]
                for item in rows
            ],
            dtype=np.float32,
        )
        for name, rows in splits.items()
    }
    supported = np.ones(len(muscles), dtype=bool)
    for name in ("train", "validation"):
        labels = targets[name]
        minimum = 2 if name == "train" else 1
        supported &= (labels == 0).sum(axis=0) >= minimum
        supported &= (labels == 1).sum(axis=0) >= minimum
    report["unsupported_muscles"] = [
        muscle for i, muscle in enumerate(muscles) if not supported[i]
    ]
    if not supported.any():
        raise ValueError(
            "No muscle has positive and negative support in training and validation"
        )
    names = sorted({key for item in splits["train"] for key in item["features"]})
    matrices = {
        name: np.asarray(
            [[item["features"].get(key, 0) for key in names] for item in rows],
            dtype=np.float32,
        )
        for name, rows in splits.items()
    }
    mean, scale = matrices["train"].mean(axis=0), matrices["train"].std(axis=0)
    scale[scale < 1e-6] = 1
    x = {
        name: torch.from_numpy((matrix - mean) / scale)
        for name, matrix in matrices.items()
    }
    y = {
        name: torch.from_numpy(labels[:, supported]) for name, labels in targets.items()
    }
    selected_muscles = [muscle for i, muscle in enumerate(muscles) if supported[i]]
    torch.manual_seed(42)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    model = nn.Linear(len(names), len(selected_muscles))
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.01, weight_decay=0.01)

    def loss(logits, labels):
        mask = labels >= 0
        errors = nn.functional.binary_cross_entropy_with_logits(
            logits, labels.clamp_min(0), reduction="none"
        )
        return ((errors * mask).sum(dim=0) / mask.sum(dim=0).clamp_min(1)).mean()

    best, state, stale, best_epoch = float("inf"), None, 0, 0
    for epoch in range(300):
        optimizer.zero_grad()
        loss(model(x["train"]), y["train"]).backward()
        optimizer.step()
        with torch.no_grad():
            validation = loss(model(x["validation"]), y["validation"]).item()
        if validation < best:
            best, stale, best_epoch = validation, 0, epoch + 1
            state = {
                key: value.detach().clone() for key, value in model.state_dict().items()
            }
        else:
            stale += 1
        if stale >= 30:
            break
    model.load_state_dict(state)
    with torch.no_grad():
        probabilities = model(x["held_out"]).sigmoid().numpy()
    training_labels = y["train"].numpy()
    prevalence = (training_labels == 1).sum(axis=0) / (training_labels >= 0).sum(axis=0)
    report.update(
        {
            "split_families": assignments,
            "split_content_ids": {
                name: [item["content_id"] for item in rows]
                for name, rows in splits.items()
            },
            "muscles": selected_muscles,
            "features": names,
            "best_epoch": best_epoch,
            "validation_bce": best,
            "threshold": 0.5,
            "held_out": metrics(probabilities, y["held_out"].numpy()),
            "baseline": metrics(
                np.broadcast_to(prevalence, probabilities.shape), y["held_out"].numpy()
            ),
        }
    )
    return {
        "schema_version": 1,
        "state_dict": state,
        "features": names,
        "muscles": selected_muscles,
        "mean": mean.tolist(),
        "scale": scale.tolist(),
        "threshold": 0.5,
        "catalog_sha256": hashlib.sha256(args.catalog.read_bytes()).hexdigest(),
        "reviews_sha256": hashlib.sha256(args.reviews.read_bytes()).hexdigest(),
        "report": report,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["audit", "train", "predict"])
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--reviews", type=Path)
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--content-id")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.mode == "predict":
        if not args.checkpoint or not args.content_id:
            parser.error("predict requires --checkpoint and --content-id")
        checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
        if checkpoint["schema_version"] != 1:
            raise ValueError("Unsupported checkpoint")
        sample = next(
            item
            for item in read_json(args.catalog)["examples"]
            if item["content_id"] == args.content_id
        )
        values = features(sample)
        unknown = sorted(set(values) - set(checkpoint["features"]))
        if unknown:
            raise ValueError(f"Input contains unseen motion/setup features: {unknown}")
        matrix = np.asarray(
            [values.get(key, 0) for key in checkpoint["features"]], dtype=np.float32
        )
        model = nn.Linear(len(matrix), len(checkpoint["muscles"]))
        model.load_state_dict(checkpoint["state_dict"])
        tensor = torch.from_numpy(
            ((matrix - checkpoint["mean"]) / checkpoint["scale"]).astype(np.float32)
        )
        with torch.no_grad():
            scores = model(tensor).sigmoid().tolist()
        save_json(
            args.output,
            {
                "content_id": sample["content_id"],
                "research_only": True,
                "muscles": [
                    {
                        "slug": muscle,
                        "score": score,
                        "working": int(score >= checkpoint["threshold"]),
                    }
                    for muscle, score in zip(checkpoint["muscles"], scores, strict=True)
                ],
            },
        )
        return
    if not args.reviews:
        parser.error("audit/train require --reviews")
    examples, muscles, report = load_examples(args.catalog, args.reviews)
    checkpoint = None
    if args.mode == "train":
        try:
            checkpoint = train(examples, muscles, args, report)
        except ValueError as error:
            report["training_blocked"] = str(error)
    args.output.mkdir(parents=True, exist_ok=False)
    save_json(args.output / "audit.json", report)
    if checkpoint:
        torch.save(checkpoint, args.output / "involvement.pt")
    print(
        json.dumps(
            {
                key: report[key]
                for key in ("public_examples", "eligible_examples", "eligible_families")
            }
        )
    )
    if "training_blocked" in report:
        parser.exit(2, report["training_blocked"] + "\n")


if __name__ == "__main__":
    main()
