# KineVault Z-Anatomy model

Derived model: `model.glb`

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
