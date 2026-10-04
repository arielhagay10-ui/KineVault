# KineVault Z-Anatomy model

Derived model: `model.glb`

Interactive preview: `model.meshopt.32c5dfc3.glb`, prepared October 3, 2026.
This preview uses lossless `EXT_meshopt_compression`. All 784 named meshes,
vertex attributes, index order, transforms and copyright metadata are preserved.
Only binary storage and zero alignment padding change; no additional geometry
reduction, quantization or mesh merging is applied. The preview uses the same
CC BY-SA 4.0 license and upstream notices as the original export.

Reproduce with `node scripts/prepare-anatomy.mjs`; verify with `--check`.
The script decodes and compares all 2,352 buffer views before writing the preview.
Source SHA-256: `ee6e35fb694d29af4f790eb97e141999c2c29c02ada33de0d1a3dc90fb9a61ed`.
Preview SHA-256: `32c5dfc35e3c0baef93c88b350b5ea8228bbf4d38f903f54230f6d0fa420f8b1`.

Z-Anatomy — The open source atlas of anatomy, by Gauthier Kervyn and contributors, licensed under Creative Commons Attribution-ShareAlike 4.0 International.

BodyParts3D © The Database Center for Life Science, licensed under Creative Commons Attribution-ShareAlike 2.1 Japan.

Sources retrieved September 28, 2026:

- https://github.com/LluisV/Z-Anatomy/blob/PC-Version/Resources/Models/FBX/MuscularSystem100.fbx
- https://github.com/LluisV/Z-Anatomy/blob/PC-Version/Resources/Models/FBX/SkeletalSystem100.fbx
- https://github.com/LluisV/Z-Anatomy/blob/PC-Version/Resources/Models/License.txt
- https://github.com/Z-Anatomy/Models-of-human-anatomy

License links:

- https://creativecommons.org/licenses/by-sa/4.0/
- https://creativecommons.org/licenses/by-sa/2.1/jp/

Modifications: selected muscles and structural bones/cartilage/teeth; removed fascia, bursae, landmark overlays, cross-section helpers and textures; reduced geometry; recomputed normals; normalized transforms and scale; changed materials. Kept the original named muscle meshes, including some tendons and sheaths. KineVault adds approximate joint pivots and vertex weights at runtime for illustrative exercise poses, with forward elbow flexion, wrist orientation and articulated fingers for dumbbell grips. This is not a biomechanical simulation. The downloadable GLB contains the resting anatomical model; runtime posing is defined in src/lib/motion/anatomy.ts.

This modified model is distributed under CC BY-SA 4.0. Preserve this attribution and the supplied upstream notices when redistributing it. Credit the source, link the license and indicate modifications. Any further adapted model assets must be distributed under the same or a compatible ShareAlike license.

The complete upstream atlas includes separately licensed inner-ear and kidney assets with noncommercial restrictions. These are excluded from this muscle/skeleton-only derivative.
