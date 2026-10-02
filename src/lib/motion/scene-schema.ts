import { z } from "zod";
import { cableAttachmentSlugs, jointLimits, jointSlugs, studioAssetSlugs } from "./workshop";
import { maxPulleyHeight, studioAttachmentSlots } from "./studio";
import { isStudioMachine } from "./studio-machines";

const finite = z.number().finite();
const transformFields = {
  x: finite.min(-10).max(10), y: finite.min(-3).max(10), z: finite.min(-10).max(10),
  rotationX: finite.min(-180).max(180), rotationY: finite.min(-180).max(180), rotationZ: finite.min(-180).max(180),
  scale: finite.min(0.5).max(2),
};
export const studioLayoutSchema = z.object({
  body: z.object(transformFields).strict(),
  frontalPlane: z.boolean().optional(),
  seating: z.object({ benchId: z.uuid(), facing: z.enum(["front", "left", "right", "back"]) }).strict().optional(),
  presentation: z.object({
    highlight: z.string().min(1).max(200).regex(/^(none|group:[a-z]+|mesh:[^\r\n]+)$/),
    isolate: z.boolean(), view: z.enum(["front", "side", "three_quarter", "back"]),
  }).strict().optional(),
  objects: z.array(z.object({
    ...transformFields, id: z.uuid(), name: z.string().trim().min(1).max(60), slug: z.enum(studioAssetSlugs),
    attachment: z.enum(["none", "left", "right", "both"]), pulleyHeight: finite.min(0.2).max(maxPulleyHeight),
    frames: z.array(z.object({ ...transformFields, timeMs: z.number().int().min(0).max(60_000), machinePosition: finite.min(0).max(1).optional(), machineHandleHeight: finite.min(0.7).max(1.85).optional() }).strict()).min(1).max(24).optional(),
    machinePosition: finite.min(0).max(1).optional(),
    machineHandleHeight: finite.min(0.7).max(1.85).optional(),
    machineUse: z.boolean().optional(),
    machineGrip: z.enum(["supinated", "pronated"]).optional(),
    machineMode: z.enum(["regular", "reverse"]).optional(),
    machinePalm: z.enum(["inward", "outward"]).optional(),
    machineElbowPath: z.enum(["beside-body", "shoulder-height"]).optional(),
    benchAngle: finite.min(0).max(85).optional(),
    cableAttachment: z.enum(cableAttachmentSlugs).optional(),
    cuffPosition: z.enum(["wrist", "upper-arm"]).optional(),
    shoulderAlignment: z.enum(["left", "right"]).optional(),
    elbowLocks: z.object({
      left: z.object({ x: finite.min(-10).max(10), y: finite.min(-3).max(10), z: finite.min(-10).max(10) }).strict().optional(),
      right: z.object({ x: finite.min(-10).max(10), y: finite.min(-3).max(10), z: finite.min(-10).max(10) }).strict().optional(),
    }).strict().optional(),
  }).strict()).max(20),
}).strict().superRefine((layout, context) => {
  if (new Set(layout.objects.map(object => object.id)).size !== layout.objects.length) context.addIssue({ code: "custom", path: ["objects"], message: "Scene object IDs must be unique" });
  if (layout.seating && !layout.objects.some(object => object.id === layout.seating!.benchId && object.slug === "bench")) context.addIssue({ code: "custom", path: ["seating", "benchId"], message: "Seating requires a bench in the scene" });
  const hands = new Set<string>();
  if (layout.objects.filter(object => object.machineUse).length > 1) context.addIssue({ code: "custom", path: ["objects"], message: "Use one machine at a time" });
  for (const [index, object] of layout.objects.entries()) {
    if (object.slug !== "cable-row-machine") {
      if (object.machineHandleHeight !== undefined) context.addIssue({ code: "custom", path: ["objects", index, "machineHandleHeight"], message: "Handle height requires a cable row" });
      object.frames?.forEach((frame, frameIndex) => { if (frame.machineHandleHeight !== undefined) context.addIssue({ code: "custom", path: ["objects", index, "frames", frameIndex, "machineHandleHeight"], message: "Handle height requires a cable row" }); });
    }
    for (const field of ["machinePalm", "machineElbowPath"] as const) {
      if (object[field] !== undefined && !["cable-row-machine", "pec-deck"].includes(object.slug)) context.addIssue({ code: "custom", path: ["objects", index, field], message: "Palm and elbow choices require a cable row or pec deck" });
    }
    if (object.machineMode !== undefined && object.slug !== "pec-deck") context.addIssue({ code: "custom", path: ["objects", index, "machineMode"], message: "Regular and reverse modes require a pec deck" });
    if (object.machineGrip !== undefined && object.slug !== "lat-pulldown-machine") context.addIssue({ code: "custom", path: ["objects", index, "machineGrip"], message: "Grip selection requires a pulldown machine" });
    if ((object.machinePosition !== undefined || object.machineUse !== undefined || object.frames?.some(frame => frame.machinePosition !== undefined)) && !isStudioMachine(object.slug)) context.addIssue({ code: "custom", path: ["objects", index, "slug"], message: "Machine controls require a machine" });
    if (object.machineUse && layout.seating) context.addIssue({ code: "custom", path: ["objects", index, "machineUse"], message: "Stand up from the bench before using a machine" });
    if (object.machineUse && layout.objects.some(item => item.attachment !== "none")) context.addIssue({ code: "custom", path: ["objects", index, "machineUse"], message: "Release held equipment before using a machine" });
    if (object.benchAngle !== undefined && object.slug !== "bench") context.addIssue({ code: "custom", path: ["objects", index, "benchAngle"], message: "Only benches have a pad angle" });
    if (object.cableAttachment !== undefined && object.slug !== "cable-machine") context.addIssue({ code: "custom", path: ["objects", index, "cableAttachment"], message: "Only cable machines have cable attachments" });
    if (object.cuffPosition !== undefined && object.slug !== "cable-machine") context.addIssue({ code: "custom", path: ["objects", index, "cuffPosition"], message: "Cuff placement requires a cable machine" });
    if (object.shoulderAlignment !== undefined && object.slug !== "cable-machine") context.addIssue({ code: "custom", path: ["objects", index, "shoulderAlignment"], message: "Shoulder alignment requires a cable machine" });
    for (const side of ["left", "right"] as const) {
      if (object.elbowLocks?.[side] && (!["barbell", "dumbbell", "kettlebell"].includes(object.slug) || ![side, "both"].includes(object.attachment))) context.addIssue({ code: "custom", path: ["objects", index, "elbowLocks", side], message: "Elbow locks require a weight held by that hand" });
    }
    if (object.attachment !== "none" && !["barbell", "dumbbell", "kettlebell", "cable-machine"].includes(object.slug)
      || object.attachment === "both" && !["barbell", "kettlebell"].includes(object.slug) && !(object.slug === "cable-machine" && !["d-handle", "cuff"].includes(object.cableAttachment ?? "d-handle"))) context.addIssue({ code: "custom", path: ["objects", index, "attachment"], message: "This equipment cannot use that grip" });
    for (const hand of studioAttachmentSlots(object)) {
      if (hands.has(hand)) context.addIssue({ code: "custom", path: ["objects", index, "attachment"], message: "A hand can hold one item at a time" });
      hands.add(hand);
    }
    object.frames?.forEach((frame, frameIndex) => {
      if (frameIndex === 0 && frame.timeMs !== 0 || frameIndex > 0 && frame.timeMs <= object.frames![frameIndex - 1].timeMs) context.addIssue({ code: "custom", path: ["objects", index, "frames", frameIndex, "timeMs"], message: "Equipment frames must start at zero and be ordered" });
    });
  }
});
const angles = z.object({ x: finite, y: finite, z: finite }).strict();
const poses = z.partialRecord(z.enum(jointSlugs), angles).superRefine((value, context) => {
  for (const [slug, angle] of Object.entries(value)) {
    const limits = jointLimits[slug as keyof typeof jointLimits];
    for (const axis of ["x", "y", "z"] as const) {
      if (angle[axis] < limits[axis][0] || angle[axis] > limits[axis][1]) {
        context.addIssue({ code: "custom", path: [slug, axis], message: `${slug} ${axis} is outside the rig range` });
      }
    }
  }
});
export const motionAnnotationSchema = z.object({
  startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(),
  label: z.string().trim().min(1).max(80), note: z.string().trim().max(500).nullable(),
  jointAction: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).nullable(),
}).strict().refine((value) => value.endMs > value.startMs, "Annotation must end after it starts");

export const workshopSceneSchema = z.object({
  studio: studioLayoutSchema.optional(),
  motionStyle: z.enum(["free", "squat", "hinge", "row", "split-squat", "bench-press", "seated-curl", "incline-curl"]).optional(),
  durationMs: z.number().int().min(250).max(60_000),
  cameraAngle: z.enum(["front", "side", "three_quarter"]),
  equipment: z.object({
    slug: z.enum(["dumbbell-pair", "barbell", "single-cable"]),
    x: finite.min(-3).max(3),
    y: finite.min(-3).max(3),
    z: finite.min(-3).max(3),
    scale: finite.min(0.5).max(2),
  }).strict().nullable(),
  keyframes: z.array(z.object({ timeMs: z.number().int(), poses }).strict()).min(2).max(24),
  annotations: z.array(motionAnnotationSchema).max(24).default([]),
}).strict().superRefine((scene, context) => {
  scene.studio?.objects.forEach((object, objectIndex) => object.frames?.forEach((frame, frameIndex) => {
    if (frame.timeMs > scene.durationMs) context.addIssue({ code: "custom", path: ["studio", "objects", objectIndex, "frames", frameIndex, "timeMs"], message: "Equipment movement extends beyond the scene" });
  }));
  let previous = -1;
  scene.keyframes.forEach((frame, index) => {
    if (frame.timeMs <= previous || frame.timeMs > scene.durationMs) {
      context.addIssue({ code: "custom", path: ["keyframes", index, "timeMs"], message: `Keyframe ${index + 1} is out of order` });
    }
    previous = frame.timeMs;
  });
  if (scene.keyframes[0]?.timeMs !== 0 || previous !== scene.durationMs) {
    context.addIssue({ code: "custom", path: ["keyframes", scene.keyframes[0]?.timeMs !== 0 ? 0 : scene.keyframes.length - 1, "timeMs"], message: "Timeline must start at 0 and end at its duration" });
  }
  scene.annotations.forEach((item, index) => {
    if (item.endMs > scene.durationMs) context.addIssue({ code: "custom", path: ["annotations", index, "endMs"], message: "Annotation extends beyond the scene" });
  });
});
