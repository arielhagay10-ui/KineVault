"""Small motion-to-EMG models. Outputs are signal estimates, not activation percentages."""

from torch import nn


class MuscleModel(nn.Module):
    def __init__(self, features: int, muscles: int = 3):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Conv1d(features, 32, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Conv1d(32, 64, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Conv1d(64, muscles, kernel_size=1),
            nn.Softplus(),
        )

    def forward(self, motion):
        return self.layers(motion.transpose(1, 2)).transpose(1, 2)


class LinearBaseline(nn.Module):
    def __init__(self, features: int, muscles: int = 3):
        super().__init__()
        self.layer = nn.Linear(features, muscles)

    def forward(self, motion):
        return self.layer(motion)
