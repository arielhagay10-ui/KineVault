"""Read the published 100 Hz joint/sensor table without executing source objects."""

from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
import torch
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, sosfiltfilt
from torch.utils.data import Dataset

JOINTS = [
    "arm_flex_r",
    "arm_add_r",
    "arm_rot_r",
    "elbow_flex_r",
    "pro_sup_r",
    "wrist_flex_r",
    "wrist_dev_r",
]
# Sensor assignments: ULTRA-MoCap paper, Tables 3 and 4.
MUSCLES = ["right_biceps_brachii", "right_triceps_brachii", "right_middle_deltoid"]
CHANNELS = ["IM EMG4", "IM EMG5", "IM EMG6"]
SAMPLE_RATE = 100
FEATURES = [
    f"{joint}:{kind}" for kind in ["sin", "cos", "velocity_rad_s"] for joint in JOINTS
]


@dataclass
class Trial:
    subject: str
    name: str
    time: np.ndarray
    motion: np.ndarray
    emg: np.ndarray
    padding_rows: int = 0


def motion_features(time: np.ndarray, angles: np.ndarray) -> np.ndarray:
    time = np.asarray(time, dtype=np.float64)
    angles = np.asarray(angles, dtype=np.float64)
    if time.ndim != 1 or angles.shape != (len(time), len(JOINTS)) or len(time) < 64:
        raise ValueError(
            f"Expected at least 64 timestamps and {len(JOINTS)} ordered joint columns."
        )
    if not np.isfinite(time).all() or not np.isfinite(angles).all():
        raise ValueError("Motion contains non-finite values.")
    if not np.allclose(np.diff(time), 1 / SAMPLE_RATE, rtol=0.01, atol=1e-6):
        raise ValueError(
            "Expected increasing, uniformly spaced 100 Hz timestamps in seconds."
        )
    radians = np.unwrap(np.deg2rad(angles), axis=0)
    features = np.concatenate(
        [
            np.sin(radians),
            np.cos(radians),
            np.gradient(radians, time, axis=0),
        ],
        axis=1,
    )
    return features.astype(np.float32)


def read_trials(path: Path) -> list[Trial]:
    trials = []
    # The supplied HDF5 has already discarded the original 2 kHz bandwidth.
    # This target is a smoothed low-rate EMG magnitude, not physiological activation.
    bandpass = butter(4, [5, 45], btype="bandpass", fs=SAMPLE_RATE, output="sos")
    with h5py.File(path, "r") as source:
        for subject in sorted(
            source, key=lambda key: int(key.removeprefix("subject_"))
        ):
            for action in sorted(source[subject]):
                for condition in sorted(source[subject][action]):
                    name = f"{subject}/{action}/{condition}"
                    dataset = source[name]
                    columns = [
                        item.decode() if isinstance(item, bytes) else str(item)
                        for item in dataset.attrs["column_names"]
                    ]
                    required = ["time", *JOINTS, *CHANNELS]
                    if len(columns) != len(set(columns)) or not set(required).issubset(
                        columns
                    ):
                        raise ValueError(f"Missing or duplicate columns in {name}.")
                    indices = sorted(columns.index(column) for column in required)
                    raw = dataset[:, indices]
                    raw[(raw == b"") | (raw == "")] = np.nan
                    selected = raw.astype(np.float64)
                    complete = np.isfinite(selected).all(axis=1)
                    valid = np.flatnonzero(complete)
                    if not len(valid):
                        raise ValueError(f"No complete joint/EMG rows in {name}.")
                    first, stop = int(valid[0]), int(valid[-1]) + 1
                    padding = len(selected) - (stop - first)
                    if padding > 5 or not complete[first:stop].all():
                        raise ValueError(
                            f"Unexpected missing or non-finite data in {name}."
                        )
                    # The published merged table includes an empty trailing sensor row.
                    selected = selected[first:stop]
                    values = {
                        columns[index]: selected[:, position]
                        for position, index in enumerate(indices)
                    }
                    time = values["time"]
                    angles = np.column_stack([values[column] for column in JOINTS])
                    emg = np.column_stack([values[column] for column in CHANNELS])
                    if not np.isfinite(emg).all():
                        raise ValueError(f"Non-finite EMG in {name}.")
                    motion = motion_features(time, angles)
                    filtered = sosfiltfilt(bandpass, emg, axis=0)
                    envelope = np.sqrt(
                        np.maximum(
                            0,
                            uniform_filter1d(
                                filtered**2, size=21, axis=0, mode="nearest"
                            ),
                        )
                    )
                    if len(time) < 192:
                        raise ValueError(
                            f"Trial too short after filter-edge trimming: {name}."
                        )
                    trim = slice(64, -64)
                    trials.append(
                        Trial(
                            subject,
                            name,
                            time[trim],
                            motion[trim],
                            envelope[trim].astype(np.float32),
                            padding,
                        )
                    )
            print(
                f"Loaded {subject}: {sum(trial.subject == subject for trial in trials)} trials",
                flush=True,
            )
    if not trials:
        raise ValueError("No trials found in the HDF5 file.")
    return trials


def fit_normalization(trials: list[Trial]) -> dict:
    motion = np.concatenate([trial.motion for trial in trials])
    emg = np.concatenate([trial.emg for trial in trials])
    scale = np.quantile(emg, 0.95, axis=0)
    if (scale <= 1e-12).any():
        raise ValueError("A training EMG channel has no usable signal.")
    return {
        "mean": motion.mean(axis=0).tolist(),
        "std": np.maximum(motion.std(axis=0), 1e-4).tolist(),
        "target_scale": scale.tolist(),
        "target_mean": (emg / scale).mean(axis=0).tolist(),
    }


class MotionWindows(Dataset):
    def __init__(
        self,
        trials: list[Trial],
        normalization: dict,
        window: int = 64,
        stride: int = 32,
    ):
        if window < 16 or stride < 1 or not trials:
            raise ValueError("Invalid window size, stride, or empty participant split.")
        self.motion = []
        self.targets = []
        self.index = []
        mean = np.asarray(normalization["mean"], dtype=np.float32)
        std = np.asarray(normalization["std"], dtype=np.float32)
        scale = np.asarray(normalization["target_scale"], dtype=np.float32)
        self.window = window
        for index, trial in enumerate(trials):
            self.motion.append(
                torch.from_numpy(((trial.motion - mean) / std).astype(np.float32))
            )
            self.targets.append(
                torch.from_numpy((trial.emg / scale).astype(np.float32))
            )
            self.index.extend(
                (index, start)
                for start in range(0, len(trial.time) - window + 1, stride)
            )
        if not self.index:
            raise ValueError("No full windows in this participant split.")

    def __len__(self):
        return len(self.index)

    def __getitem__(self, index):
        trial, start = self.index[index]
        stop = start + self.window
        return self.motion[trial][start:stop], self.targets[trial][start:stop]
