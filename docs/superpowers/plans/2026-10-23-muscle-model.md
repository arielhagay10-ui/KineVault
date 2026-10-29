# Muscle model implementation plan

**Goal:** Train a standalone three-muscle motion-to-EMG prototype using the published ULTRA-MoCap release.

**Approved design:** The user approved starting the small Python/PyTorch temporal model described in chat. Joint-angle sequences are inputs; measured EMG is the initial target. Exercise-level binary labels require separate reviewed supervision.

**Scope:** New files under `tools/muscle-model/`; downloaded data, environments, checkpoints, and measurements under ignored `.local-artifacts/muscle-model/`. Preserve existing application behavior and unrelated changes. Do not add or run implementation tests without a user request.

- [x] Confirm the published source license, download the processed archive, and verify its published checksum.
- [x] Inspect actual trial structure and timestamps. Implement explicit column selection, numerical validation, synchronization, and preprocessing matching the available modalities. Reject missing or ambiguous target channels.
- [x] Split entire participants before fitting preprocessing. Reserve separate training, validation, and held-out participant groups; never split overlapping windows across them.
- [x] Implement a small temporal convolution model and a simple baseline, checkpointing the feature order, muscle order, source license, split, and fitted preprocessing.
- [x] Train on real trials, select checkpoints on validation data, and report held-out error against the baseline without claiming physiological activation or general gym coverage.
- [x] Provide inference and reproducible CLI instructions. Run syntax/lint checks and report actual training results and remaining limitations.

Dependencies and parsing details will be selected from the archive's actual format. Do not invent labels, fabricate training results, or load source pickle files as executable Python objects.

Outcome: the 13,891-parameter temporal network trained on real data but underperformed the constant baseline on held-out participants. See `tools/muscle-model/README.md` and `.local-artifacts/muscle-model/runs/initial/report.json`. No application integration is justified by the current results.
