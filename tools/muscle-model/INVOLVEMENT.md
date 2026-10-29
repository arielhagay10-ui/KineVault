# Binary muscle involvement

This experiment is separate from the three-channel EMG prototype. It predicts reviewed exercise-level involvement with one independent sigmoid output per muscle. Outputs use the current KineVault muscle taxonomy. A score is not an activation percentage or a calibrated probability.

## Current data

The public local catalog export on 2026-10-23 contains **one exercise**, Cable Lateral Raise. Its scene has two shoulder keyframes over 500 ms, one catalog muscle tag, no classification confidence and no resistance source. **Zero examples qualify for training.** No new binary checkpoint or accuracy claim exists.

The exporter uses the configured publishable key and anonymous RLS. It selects current published versions only, pages through results, preserves content IDs, family IDs, raw quaternions, equipment, setup and catalog tags, and hashes each snapshot. Private drafts and pending candidates are excluded. It does not write to Supabase. Catalog tags are suggestions for review, not automatic training targets.

## Export and review

From the repository root:

```powershell
node tools/muscle-model/export-catalog.mjs .local-artifacts/muscle-model/catalog-new
```

The destination must not exist. The output includes `catalog.json` and `reviews.json`. Review the exact exported version and fill each review:

- `reviewer`: the person responsible for the annotations.
- `evidence`: references or a specific written review supporting the labels and setup.
- `rights_confirmed`: permission to use this content for model training has been checked. Public visibility alone does not establish a license.
- `motion_reviewed` and `setup_reviewed`: the stored demonstration and resistance setup match the exercise being labeled.
- `group_id`: the exported family ID. For exercises without a family, assign a shared group to related variants before splitting.
- `labels`: explicit muscle-slug keys with `1` for working, `0` for reviewed non-involvement, and `null` or an omitted key for unknown. Include primary, secondary and stabilizing involvement in the definition of working. Agree on that annotation policy before labeling a batch.

For example, `{"lateral-deltoid": 1, "biceps-brachii": null}` has one positive label and no negative label. Use actual slugs from `catalog.json`. Do not infer negative labels from missing catalog tags. Do not mark these flags true merely to make training run.

Snapshots are immutable export artifacts. Correct incomplete metadata in the normal reviewed authoring flow, then export again and review the new snapshot. Reviews with a different snapshot hash are rejected.

## Audit and train

Use the existing isolated Python environment:

```powershell
$modelPython = '.local-artifacts/muscle-model/venv/Scripts/python.exe'
& $modelPython tools/muscle-model/involvement.py audit `
  --catalog .local-artifacts/muscle-model/catalog-new/catalog.json `
  --reviews .local-artifacts/muscle-model/catalog-new/reviews.json `
  --output .local-artifacts/muscle-model/audit-new

& $modelPython tools/muscle-model/involvement.py train `
  --catalog .local-artifacts/muscle-model/catalog-new/catalog.json `
  --reviews .local-artifacts/muscle-model/catalog-new/reviews.json `
  --output .local-artifacts/muscle-model/involvement-new
```

Each output directory must be new. `audit.json` lists exclusion reasons and positive/negative counts. Training writes the audit and exits with code 2 when data is insufficient.

The small model is a single linear layer with independent sigmoid outputs. It uses masked binary cross entropy, so unknown labels contribute no loss. Features describe start rotations and relative rotation extrema/endpoints, equipment roles, body position, grip, stance, resistance source and resistance profile. Names, muscle tags, family IDs and confidence are not inputs. Features and normalization are fitted on training families only.

At least ten eligible families are required just to attempt a split. This is a guard against trivial experiments, not evidence that ten families are sufficient. A fixed seed assigns about 60% of families to training, 20% to validation and 20% to held-out evaluation. All variants in an exported family stay together. Resolve duplicate or overlapping families before export. Never create extra examples by copying the same exercise or its frames.

Each output needs two reviewed positives and two negatives in training, and at least one of each in validation. Unsupported muscles are reported and excluded. Held-out labels never select outputs, thresholds or checkpoints. Validation loss selects the checkpoint, with a fixed 0.5 threshold. Held-out precision, recall and F1 include class counts and a training-prevalence baseline. Metrics are null for muscles lacking either class in the held-out set. Do not keep trying seeds until scores improve.

## Inference and limits

After genuine training produces a checkpoint:

```powershell
& $modelPython tools/muscle-model/involvement.py predict `
  --catalog .local-artifacts/muscle-model/catalog-new/catalog.json `
  --checkpoint .local-artifacts/muscle-model/involvement-new/involvement.pt `
  --content-id CONTENT_UUID `
  --output .local-artifacts/muscle-model/involvement-prediction.json
```

Checkpoint loading uses `weights_only=True`. Output files cannot replace existing files. Unseen joint/setup categories fail explicitly rather than silently dropping inputs. The output has one score and one thresholded 0/1 value per supported muscle.

This first version accepts only free motion with consistent recorded joint coverage. Studio scenes and machine constraints need an exporter of solved poses before they can train this model. Rig rotations are animation coordinates, not anatomical joint measurements. Keyframe extrema can miss motion between frames, and these features omit tempo, exact force vectors, load magnitude, geometry and muscle length. A setup review cannot recover missing measurements. Evaluation must establish usefulness within this limited scope before adding more features or integrating suggestions into the site.

The present blocker is collecting varied, licensed, reviewed motion/setup examples with positive and negative muscle annotations. Existing development seed classifications and external text-only exercise tags do not supply that ground truth automatically.
