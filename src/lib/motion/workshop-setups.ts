import { z } from "zod";
import { studioLayoutSchema } from "./scene-schema";
import { sampleStudioObject } from "./studio";
import { identityTransform, type WorkshopScene } from "./workshop";

const setupSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(60),
  cameraAngle: z.enum(["front", "side", "three_quarter"]), studio: studioLayoutSchema,
});
export type WorkshopSetup = z.infer<typeof setupSchema>;
export const workshopSetupKey = (ownerId: string) => `kinevault.workshop.setups.${ownerId}`;
export function readWorkshopSetups(value: string | null): WorkshopSetup[] {
  try { const result = z.array(setupSchema).max(12).safeParse(JSON.parse(value ?? "[]")); return result.success ? result.data : []; }
  catch { return []; }
}
export function captureWorkshopSetup(scene: WorkshopScene, name: string, id: string): WorkshopSetup {
  const studio = scene.studio ?? { body: identityTransform, objects: [] };
  return setupSchema.parse({ id, name, cameraAngle: scene.cameraAngle, studio: {
    ...studio, objects: studio.objects.map(object => ({ ...sampleStudioObject(object, 0), frames: undefined })),
  } });
}
export function applyWorkshopSetup(scene: WorkshopScene, setup: WorkshopSetup): WorkshopScene {
  return { ...scene, equipment: null, cameraAngle: setup.cameraAngle, studio: structuredClone(setup.studio) };
}
