import type { ReactNode } from "react";

const equipmentDrawings: Record<string, ReactNode> = {
  "cable-machine": <><path d="M22 88V18h14v70M84 88V18H70v70M22 18h62M28 88h50M34 29h36M34 52h36M34 75h36" /><path d="M36 29h22l9 25M70 29H48l-9 25" strokeDasharray="3 3" /><path d="m64 54 7 3m-35 0 7-3" /></>,
  "lat-pulldown-machine": <><path d="M26 90V18h52v72M26 23h52M48 23v32M34 55h28M48 66v22M38 66h25M65 61v15M36 88h36M28 33h8v39h-8" /><path d="M35 55 25 59M62 55l12 4" /></>,
  "cable-row-machine": <><path d="M22 88V24h17v64M22 26h52v22M39 70h32M65 70v18M15 90h74M77 86l12-18M71 48h15v8H71" /><path d="M39 48h32" strokeDasharray="3 3" /></>,
  "pec-deck": <><path d="M38 87V34h28v53M32 89h44M35 69h37M37 18h32M36 18l-17 21 8 18M70 18l17 21-8 18M22 54h11M74 54h11M44 38h16v24H44" /></>,
  "smith-machine": <><path d="M19 90V17h68v73M25 22v66M81 22v66M13 88h81M14 51h80M32 46v10M75 46v10M31 76h44" /></>,
  "leg-press": <><path d="M14 83h80M23 82l-8-35 11-5 19 35M43 77l29-31M54 80l30-35M71 30l17 17M67 34l17 18M29 69h22M83 46v35" /></>,
  "squat-rack": <><path d="M23 88V18h60v70M17 88h73M23 31h60M16 49h74M21 44v11M84 44v11M23 64h60M35 49v13M71 49v13" /></>,
  bench: <><path d="m15 59 34 15h38v-8H51L20 51ZM43 74l-9 15M76 74l9 15M28 89h13M78 89h14M31 63l8-23" /></>,
  dumbbell: <><path d="m32 64 34-27M17 60l12 15 10-8-12-15ZM58 36l12 15 10-8-12-15ZM12 64l12 15M76 26l12 15" /></>,
  barbell: <><path d="M9 53h90M17 39v28M25 32v42M32 38v30M74 38v30M81 32v42M89 39v28" /></>,
  kettlebell: <><path d="M36 42c-13 11-15 25-7 34 8 10 38 10 46 0 8-9 6-23-7-34M36 43V33c0-17 32-17 32 0v10M43 42v-8c0-9 18-9 18 0v8M35 79h34" /></>,
};

export function WorkshopEquipmentPicture({ slug, className = "h-24 w-full" }: { slug: string; className?: string }) {
  const canonical = slug === "single-cable" ? "cable-machine" : slug === "dumbbell-pair" ? "dumbbell" : slug;
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 108 108" className={className} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {equipmentDrawings[canonical] ?? <path d="M27 27h54v54H27ZM27 27l54 54M81 27 27 81" />}
  </svg>;
}

/** Static endpoint picture, paired with a caption by the caller. */
export function WorkshopPosePicture({ slug, endpoint, className = "h-20 w-24" }: { slug: string; endpoint: "start" | "finish"; className?: string }) {
  const finish = endpoint === "finish", fly = slug === "pec-deck";
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 108 100" className={className} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="54" cy="17" r="8" /><path d="M54 26v36m-12 0h24M54 62l-19 26M54 62l19 26" />
    <path d={fly ? finish ? "M54 34 43 44 50 52M54 34 65 44 58 52" : "M54 34 23 35 14 49M54 34 85 35 94 49" : finish ? "M54 34 34 45 48 54M54 34 74 45 60 54" : "M54 34 30 50 14 60M54 34 78 50 94 60"} />
    <path d="M20 94h68" strokeWidth="2" opacity="0.4" />
  </svg>;
}
