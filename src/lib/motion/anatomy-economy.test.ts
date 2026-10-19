import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Vector3 } from "three";
import { anatomyEconomyModelUrl, anatomyModelUrl, createAnatomyRig, highlightAnatomyRig, poseAnatomyRig } from "./anatomy";
import { defaultScene, sampleWorkshopPose } from "./workshop";
import { studioGripOffset } from "./studio-grip";

describe("economy anatomy", () => {
  it("keeps named muscle selection and contact geometry throughout the same movement", async () => {
    const load = async (url: string) => {
      const bytes = await readFile(`public${url}`);
      return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    };
    const [full, economy] = await Promise.all([load(anatomyModelUrl), load(anatomyEconomyModelUrl)]);
    const rigs = [createAnatomyRig(full.scene), createAnatomyRig(economy.scene)];
    try {
      expect(rigs[1].muscles).toEqual(rigs[0].muscles);
      expect(rigs[1].fingerSegments.map(segment => segment.name)).toEqual(rigs[0].fingerSegments.map(segment => segment.name));
      for (const target of ["group:deltoid", "group:biceps", rigs[0].muscles[0].id]) {
        expect(highlightAnatomyRig(rigs[1], target, true)).toBe(highlightAnatomyRig(rigs[0], target, true));
      }
      const point = new Vector3(), other = new Vector3();
      const contacts = rigs[0].meshes.filter(mesh => /hand|finger|carpal|tars|foot|toe|calcane|talus|phalan/i.test(mesh.name));
      for (let step = 0; step <= 16; step++) {
        const pose = sampleWorkshopPose(defaultScene.keyframes, defaultScene.durationMs * step / 16);
        for (const rig of rigs) poseAnatomyRig(rig, pose, true);
        for (const side of ["left", "right"] as const) expect(rigs[1].handBones[side].localToWorld(studioGripOffset(side)).distanceTo(rigs[0].handBones[side].localToWorld(studioGripOffset(side)))).toBeLessThan(1e-9);
        for (const mesh of contacts) {
          const reduced = rigs[1].meshes.find(item => item.name === mesh.name)!;
          const count = mesh.geometry.getAttribute("position").count;
          expect(reduced.geometry.getAttribute("position").count).toBe(count);
          for (const index of [0, Math.floor(count / 2), count - 1]) {
            expect(mesh.getVertexPosition(index, point).distanceTo(reduced.getVertexPosition(index, other))).toBeLessThan(1e-9);
          }
        }
      }
    } finally { rigs.forEach(rig => rig.dispose()); }
  }, 15000);
});
