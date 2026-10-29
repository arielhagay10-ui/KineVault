# Motion-to-muscle research prototype

For the new exercise-level binary classifier and reviewed catalog export, see [Binary muscle involvement](INVOLVEMENT.md). The current catalog audit has one public exercise and zero eligible training examples. The EMG experiment below remains separate.

Standalone Python/PyTorch tooling for predicting three right-arm EMG magnitude signals from joint-angle sequences. The first experiment uses real ULTRA-MoCap recordings. It does not produce reviewed exercise muscle labels or activation percentages.

## Current result

The initial run used all 208 trials from 13 participants, with 624,165 usable frames after padding and filter-edge removal. Participants 1–9 train the models, 10–11 select checkpoints, and 12–13 are held out. Windows never cross trials or participant splits. All five movement types occur across splits, so this measures transfer to new participants performing known tasks.

| Predictor | Held-out mean absolute error | Held-out mean squared error |
| --- | ---: | ---: |
| Training-set mean | 0.19655 | 0.06942 |
| Linear model | 0.17914 | 0.07347 |
| Temporal convolution model | 0.25658 | 0.31606 |

Errors use each muscle's training-set 95th-percentile signal magnitude as its unit, averaged equally across muscles. They are not percentages or classification accuracy. The linear model improves mean absolute error but worsens squared error. The temporal model fails to beat the constant baseline. These results do not support application use.

Existing artifacts on this machine:

- `.local-artifacts/muscle-model/runs/initial/report.json`: full metrics, split IDs, per-muscle errors and training curves.
- `.local-artifacts/muscle-model/runs/initial/temporal.pt`: trained 13,891-parameter network.
- `.local-artifacts/muscle-model/runs/initial/linear.pt`: 66-parameter comparison model.

No application routes, database records, or workshop highlights consume these predictions.

## Source and attribution

Fritsche et al., **ULTRA-MoCap: A Multimodal IMU and sEMG Dataset for Upper Body Joint Kinematics Analysis**. Published dataset v1: <https://doi.org/10.6084/m9.figshare.28751156.v1>. License: **CC BY 4.0**, verified from the exact release's [public API](https://api.figshare.com/v2/articles/28751156/versions/1). [Paper and sensor tables](https://pmc.ncbi.nlm.nih.gov/articles/PMC13096661/).

The importer downloads `ULTra-MoCap-processed.zip`, approximately 710 MB, verifies the published MD5, and extracts only `All_subjects_data.h5`, approximately 2.25 GB. It records authors, license, DOI and an HDF5 SHA-256 in `source.json`. Data, environments and model artifacts remain in ignored `.local-artifacts/`. The training command checks the HDF5 hash against that provenance record.

Only numerical data and column names are read. Source pickle files are not used. The authors' publicly available scripts were consulted for format documentation; their code is not included.

## Run

Run from the repository root with Python 3.11 or newer. Create an isolated environment and install dependencies:

```powershell
python -m venv .local-artifacts/muscle-model/venv
$modelPython = '.local-artifacts/muscle-model/venv/Scripts/python.exe'
& $modelPython -m pip install -r tools/muscle-model/requirements.txt
& $modelPython tools/muscle-model/fetch.py
& $modelPython tools/muscle-model/train.py --epochs 20
```

The environment and downloaded source already exist on this machine. Subsequent training runs create new output directories by default; explicit nonempty output directories are rejected. Training uses CPU, four threads by default, deterministic algorithms, MSE loss, AdamW, and validation-based early stopping. Run `train.py --help` for batch size, window length, patience and learning-rate options. The held-out set is never used to choose a checkpoint.

## Representation and targets

Joint inputs are the following OpenSim columns in degrees, sampled uniformly at 100 Hz:

```text
arm_flex_r, arm_add_r, arm_rot_r, elbow_flex_r,
pro_sup_r, wrist_flex_r, wrist_dev_r
```

Each joint supplies sine, cosine and angular velocity, giving 21 features per frame. The temporal model uses two convolutions, 32 then 64 channels, followed by a three-channel positive output at each frame. The initial window length is 64 frames, or 0.64 seconds. These are fixed windows, not detected complete repetitions.

Targets use sensors 4, 5 and 6, mapped in the paper's Tables 3–4 to right biceps brachii, right triceps brachii and right middle deltoid. The parser applies a 5–45 Hz bandpass and 210 ms RMS smoothing to the already-downsampled signals, then removes 64 frames from each trial boundary. Empty padding is removed only at trial boundaries, at most five rows per trial; interior gaps and malformed data fail explicitly. The actual release contains 205 boundary padding rows across 208 trials.

Input means, standard deviations, target scales and the constant baseline are fitted using training participants only. Checkpoints contain these values, ordered features/muscles, participant splits, source provenance and PyTorch version. `predict.py` uses restricted `torch.load(..., weights_only=True)` loading.

## Inference

Provide JSON with these fields:

- `joint_columns`: the exact ordered seven names listed above.
- `time_seconds`: at least 64 increasing timestamps, uniformly spaced by 0.01 seconds.
- `angles_degrees`: one seven-number angle row per timestamp.

```powershell
& $modelPython tools/muscle-model/predict.py `
  --checkpoint .local-artifacts/muscle-model/runs/initial/temporal.pt `
  --input .local-artifacts/muscle-model/example-motion.json `
  --output .local-artifacts/muscle-model/example-prediction.json
```

The example input on this machine contains a real held-out elbow-flexion excerpt. Inference returns time-aligned predicted magnitudes in volts and training-scale units. Output files are never overwritten. Four frames at each input boundary lack full convolution context. Workshop Euler angles must not be supplied directly: matching its rig to the dataset's anatomical coordinates requires a separate validated conversion.

## Limits and next work

- The supplied processed archive downsamples original 2,000 Hz EMG to 100 Hz. Its missing bandwidth cannot be restored. This experiment targets the published low-rate signal, with no claim of a validated EMG envelope or physiological activation.
- Global training-only scaling is not maximum voluntary contraction normalization and does not remove participant-specific electrode/skin differences.
- There are only three measured muscles and five unloaded upper-limb tasks. Resistance forces, equipment mechanics, grip and supports are not available as input features here.
- Binary exercise involvement, roles and thresholds need their own reviewed labels. A nonzero signal is not an involvement annotation.
- Before proposing application integration, prepare proper envelopes from the original high-rate EMG, establish suitable normalization, and evaluate a larger reviewed set of gym movements without tuning against the current held-out participants.

Code lint and syntax checks are separate from the statistical results above. No implementation test suite was added or run for this prototype.
