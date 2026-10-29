# Datasets for predicting muscle involvement

Research date: 2026-10-23.

The proposed task is to predict one involvement label per muscle from joint movement and exercise setup. A suitable training record needs both motion inputs and muscle targets for the same trial. Exercise metadata, measured electrical signals, and simulated activations provide different kinds of targets.

## Shortlist

### ULTRA-MoCap: a small paired upper-body prototype

The authors describe 13 participants performing five upper-limb tasks: arm swing, cross-body reach, elbow flexion, shoulder rotation, and overhead reach. Data includes synchronized optical motion capture, IMUs, three right-arm sEMG channels, and OpenSim joint-angle outputs in MOT and CSV formats. The recorded muscles are biceps brachii, triceps brachii, and middle deltoid. [Paper](https://www.nature.com/articles/s41597-026-06687-5)

This is a close structural match for joint-angle inputs and muscle-related targets. Its small movement and muscle coverage limits it to a prototype; it does not supply a broad set of loaded gym exercises. This suitability assessment is an inference from the reported protocol.

The published paper links [dataset release v1](https://doi.org/10.6084/m9.figshare.28751156.v1). Its [version-specific public API](https://api.figshare.com/v2/articles/28751156/versions/1), subsequently retrieved during implementation, confirms **CC BY 4.0**. The processed archive is approximately 710 MB and contains a 2.25 GB HDF5 file. The [first author's follow-up repository](https://github.com/oliverkristianfritsche/UpperBody_Kinematics_Prediction) excludes raw recordings from that code repository; the Figshare processed release is publicly downloadable. Dataset and code licenses remain separate.

### Muscles in Action: paired motion and measured sEMG

MIA contains 12.5 hours across 10 participants and 15 exercises. The eight channels cover left and right biceps brachii, latissimus dorsi, quadriceps, and biceps femoris. The project demonstrates prediction from 3D skeleton sequences. [Project](https://musclesinaction.cs.columbia.edu/)

The [authors' repository](https://github.com/mchiquier/musclesinaction) provides a dataset archive link, pretrained models, and pose-to-EMG training code. The public README does not establish commercial reuse permission. Neither the dataset archive contents nor a separate license inside it were inspected. MIA is a useful methodological reference but lacks chest, triceps, and deltoid targets.

### Free Exercise DB: broad exercise-level labels

The project advertises 800+ exercise records with equipment, instructions, primary muscles, secondary muscles, and image references. Its schema lists 17 broad muscle/group values. It has no defined numerical joint-angle or motion-sequence field. [Repository](https://github.com/yuhonas/free-exercise-db), [schema](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/schema.json)

The repository is published under the [Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md). This states the repository's declared terms; independent upstream media provenance was not audited.

This is useful for constructing exercise-level binary label vectors. Training a joint-motion model additionally requires matching each reviewed exercise to suitable movement data. The existing label vocabulary cannot resolve individual heads or every anatomical muscle.

### MinT: large simulated target space with important coverage limits

MinT reports 9.8 hours, 227 subjects, 187 action categories, and 402 activation outputs. These outputs represent modeled muscle strands: 80 lower-body and 322 thoracolumbar strands. They do not provide 402 distinct named full-body muscles. The labels come from OpenSim simulation. Object-lifting trials assume negligible object mass, limiting relevance to loaded equipment exercises. [Paper, especially sections 4, 6 and appendix A](https://arxiv.org/html/2411.00128v1)

The [published archive](https://radar.kit.edu/radar/en/dataset/VDPCEFSThBWlDPFL) is approximately 2.1 GB. Dataset terms are CC BY-NC 4.0 plus restrictions from the source datasets. The paper describes an Apache-licensed generation pipeline and MIT-licensed training code; the current [motion2muscle repository](https://github.com/simplexsigil/motion2muscle) displays Apache-2.0. Verify the code revision separately from the data terms. This is not a commercially cleared training source. [Published paper and license appendix](https://proceedings.neurips.cc/paper_files/paper/2024/file/7c3465ba08732cc2db38f070bfae601a-Paper-Datasets_and_Benchmarks_Track.pdf)

## Recommended next step

1. Access, the exact release terms and the actual HDF5 format have now been confirmed. The first [standalone prototype and results](../tools/muscle-model/README.md) are available.
2. Prototype continuous prediction for its three measured muscles. Converting signals to binary involvement requires a defined normalization and labeling procedure; nonzero raw EMG is not a sufficient rule.
3. For broad gym coverage, build paired examples from reviewed exercise labels and corresponding KineVault movements, including equipment resistance and supports. Free Exercise DB can supply candidate labels for review.
4. Keep participants and related exercise variants separated during evaluation. Exercise tags, EMG signals, and simulated activation are separate target types and should retain their provenance.

No single shortlisted source was established as a complete, commercially cleared dataset of loaded gym movements paired with comprehensive muscle targets. The subsequent ULTRA-MoCap prototype is limited to three upper-arm EMG signals; its neural model did not beat the constant baseline on held-out participants.
