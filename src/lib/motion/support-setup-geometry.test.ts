import { expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Box3, Euler, Group, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createAdjustableBench } from "./adjustable-bench";
import { anatomyModelUrl, createAnatomyRig, poseAnatomyRig } from "./anatomy";
import { createSupportSetup } from "./support-setups";
import { applyStudioSupports, supportContactPoint } from "./support-contacts";
import { createStudioObject } from "./studio";
import { supportSurfaceFrame, supportSurfaceToWorld } from "./support-surfaces";
import { blankWorkshopScene } from "./workshop";

it("keeps bench setups reachable with torso clearance and a grounded free foot", async () => {
  const bytes = await readFile(`public${anatomyModelUrl}`);
  const model = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const rig = createAnatomyRig(model.scene);
  await mkdir(".local-artifacts/supports", { recursive: true });
  try {
    for (const scale of [.8, 1, 1.3]) for (const setup of ["bench-hand-knee", "bench-rear-foot"] as const) {
      const scene = structuredClone(blankWorkshopScene);
      const originalBench = { ...createStudioObject("bench", "bench", 0), x: .3, z: -.2, rotationY: 30, scale, benchAngle: 45 };
      scene.studio!.objects = [originalBench]; scene.studio!.body.scale = scale;
      const next = createSupportSetup(scene, setup, rig), studio = next.studio!, bench = studio.objects[0];
      expect({ x: bench.x, z: bench.z, rotationY: bench.rotationY, scale: bench.scale }).toEqual({ x: .3, z: -.2, rotationY: 30, scale });
      if (setup === "bench-hand-knee") expect(bench.benchAngle).toBe(0);
      const body = new Group(), t = studio.body;
      body.position.set(t.x, t.y, t.z);
      body.rotation.set(t.rotationX * Math.PI / 180, t.rotationY * Math.PI / 180, t.rotationZ * Math.PI / 180);
      body.scale.setScalar(t.scale); body.add(rig.root);
      try {
        for (let sample = 0; sample <= 16; sample++) {
          const time = next.durationMs * sample / 16;
          poseAnatomyRig(rig, next.keyframes[0].poses);
          const reports = applyStudioSupports(rig, studio, time, next.keyframes[0].poses);
          expect(reports.every(report => report.error < .005 * scale), JSON.stringify({ setup, scale, reports })).toBe(true);
          expect(reports.some(report => report.region.endsWith("hand") && report.orientationLimited)).toBe(false);
          for (const contact of studio.supports!) {
            const target = supportSurfaceToWorld(contact, studio, time)!;
            expect(supportContactPoint(rig, contact.region, target.normal).distanceTo(target.point)).toBeLessThan(.005 * scale);
          }
        }
        const freeFoot = setup === "bench-hand-knee" ? "right-foot" : "left-foot";
        expect(Math.abs(supportContactPoint(rig, freeFoot).y)).toBeLessThan(.005 * scale);
        if (setup === "bench-hand-knee") {
          const hangingArm = rig.handBones.right.getWorldPosition(new Vector3()).sub(rig.bones["right-shoulder"].getWorldPosition(new Vector3())).normalize();
          expect(hangingArm.dot(new Vector3(0, -1, 0))).toBeGreaterThan(Math.cos(20 * Math.PI / 180));
          expect(studio.supports!.some(contact => contact.region.startsWith("right") && !contact.region.endsWith("foot"))).toBe(false);
        }
        body.updateMatrixWorld(true); rig.skeleton.update();
        const surface = supportSurfaceFrame(bench, "pad"), surfaceInverse = surface.rotation.clone().invert();
        const benchMatrix = new Matrix4().compose(new Vector3(bench.x, bench.y, bench.z), new Quaternion().setFromEuler(new Euler(bench.rotationX * Math.PI / 180, bench.rotationY * Math.PI / 180, bench.rotationZ * Math.PI / 180)), new Vector3(scale, scale, scale));
        const benchInverse = benchMatrix.clone().invert();
        const geometry = createAdjustableBench(bench.benchAngle);
        geometry.root.updateMatrixWorld(true);
        const frameBoxes: { inverse: Matrix4; box: Box3 }[] = [];
        geometry.root.traverse(object => {
          if (object instanceof Mesh && object !== geometry.backrest && object !== geometry.seat) {
            object.geometry.computeBoundingBox();
            frameBoxes.push({ inverse: object.matrixWorld.clone().invert(), box: object.geometry.boundingBox!.clone().expandByScalar(-.002) });
          }
        });
        try {
          let handClearance = Infinity, forearmClearance = Infinity; const world = new Vector3(), local = new Vector3();
          for (const mesh of rig.meshes) {
            const torso = /pectoralis_major|rectus_abdominis|latissimus|trapezius/.test(mesh.name.toLowerCase());
            const hand = setup === "bench-hand-knee" && /(?:handl|finger_of_handl|metacarpal_bonel|palmar_interossei_musclesl|adductor_pollicisl)$/i.test(mesh.name);
            const palm = hand && /(?:palmar_interossei_musclesl|lumbrical_muscles_of_handl|abductor_digiti_minimi_of_handl|flexor_digiti_minimi_of_handl|opponens_digiti_minimi_muscle_of_handl|adductor_pollicisl)$/i.test(mesh.name);
            const bracingForearm = setup === "bench-hand-knee" && /(?:palmaris_longus.*l|flexor_digitorum_profundusl|humero.ulnar.*l)$/i.test(mesh.name);
            const standingLeg = setup === "bench-hand-knee" && /(?:tibia|fibula|gastrocnemius|soleus)r$/i.test(mesh.name);
            const workingArm = setup === "bench-hand-knee" && /(?:handr|humerusr|radiusr|ulnar|biceps_brachii.*r|triceps_brachii.*r|brachialisr)$/i.test(mesh.name);
            if (!torso && !standingLeg && !hand && !bracingForearm && !workingArm) continue;
            for (let index = 0; index < mesh.geometry.getAttribute("position").count; index++) {
              mesh.localToWorld(mesh.getVertexPosition(index, world));
              if (torso || hand || bracingForearm || workingArm) {
                local.copy(world).sub(surface.origin).applyQuaternion(surfaceInverse).divideScalar(scale);
                if (palm && Math.abs(local.x) < .22 && local.y > 0 && local.y < 1.62) handClearance = Math.min(handClearance, local.z - .054);
                const insidePad = Math.abs(local.x) < .22 && local.y > 0 && local.y < 1.62 && Math.abs(local.z) < .054;
                if (bracingForearm && Math.abs(local.x) < .22 && local.y > 0 && local.y < 1.62) forearmClearance = Math.min(forearmClearance, local.z - .054);
                expect(insidePad, `${setup}: ${mesh.name} crosses pad`).toBe(false);
              }
              if (standingLeg || workingArm) {
                local.copy(world).applyMatrix4(benchInverse);
                expect(frameBoxes.some(frame => frame.box.containsPoint(local.clone().applyMatrix4(frame.inverse))), `${setup}: free limb ${mesh.name} crosses frame`).toBe(false);
              }
            }
          }
          if (setup === "bench-hand-knee") {
            expect(handClearance).toBeGreaterThanOrEqual(-.001);
            expect(handClearance).toBeLessThan(.005);
            await writeFile(`.local-artifacts/supports/${setup}-${scale}-clearance.json`, JSON.stringify({ handClearance, forearmClearance }, null, 2));
          }
        } finally { geometry.dispose(); }
      } finally { body.remove(rig.root); }
    }
  } finally { rig.dispose(); }
});




