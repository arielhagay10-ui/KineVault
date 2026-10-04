"use client";

import { WorkshopGuidance } from "./workshop-guidance";

import { useMemo, useState } from "react";
import type { WorkshopScene } from "@/lib/motion/workshop";
import { MotionCanvas, type WorkshopLinkedCamera } from "./motion-canvas";
import { useWorkshopLanguage } from "./workshop-language";

export function WorkshopComparison({ scene }: { scene: WorkshopScene }) {
  const { t } = useWorkshopLanguage();
  const [camera, setCamera] = useState<WorkshopLinkedCamera | null>(null);
  const comparisonScene = useMemo(() => scene.studio?.presentation ? {
    ...scene, studio: { ...scene.studio, presentation: { ...scene.studio.presentation, isolate: false } },
  } : scene, [scene]);
  return (<section aria-label={t("Start and finish comparison")} className="space-y-3">
    <WorkshopGuidance essential className="text-sm">{t("Rotate, pan or zoom either view. Both views use the same camera. Editing controls still affect the selected pose.")}</WorkshopGuidance>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[0, scene.durationMs / 2].map((timeMs, index) => <section key={index} aria-label={t(`${index === 0 ? "Start" : "Finish"} pose comparison`)}>
      <h3 className="mb-2 font-semibold">{index === 0 ? t("Start") : t("Finish")} · {(timeMs / 1000).toFixed(2)}{t("s")}</h3>
      <MotionCanvas scene={comparisonScene} timeMs={timeMs} showMuscleControls={false} simplifiedControls compact linkedCamera={camera} onCameraChange={setCamera} className="h-[clamp(220px,40dvh,480px)]" />
    </section>)}</div>
    <p className="text-xs leading-relaxed text-muted-foreground">
      {t("Z-Anatomy — Gauthier Kervyn & contributors · github.com/Z-Anatomy/Models-of-human-anatomy")}<br />
      {t("BodyParts3D © The Database Center for Life Science · Adapted geometry, materials and posing")}<br />
      <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>{" · "}
      <a className="underline" href="https://creativecommons.org/licenses/by-sa/2.1/jp/">CC BY-SA 2.1 Japan</a>
    </p>
  </section>);
}
