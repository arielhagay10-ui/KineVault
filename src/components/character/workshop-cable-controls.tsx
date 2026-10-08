"use client";

import { TriangleAlert } from "@/components/ui/icons";
import { cableAttachmentNames } from "@/lib/motion/studio-cable";
import { cableAttachmentSlugs, type CableAttachment, type JointSlug, type StudioObject } from "@/lib/motion/workshop";
import { useWorkshopLanguage } from "./workshop-language";

const buttonClass = "min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary";

export function WorkshopCableControls({ object, onAttachment, onHold, onCuffPosition, palmTurns, onPalmTurn, onJoint, reachable }: {
  object: StudioObject;
  onAttachment: (attachment: CableAttachment) => void;
  onHold: (hand: StudioObject["attachment"]) => void;
  onCuffPosition: (position: "wrist" | "upper-arm") => void;
  palmTurns: Record<"left" | "right", number>;
  onPalmTurn: (side: "left" | "right", turn: number) => void;
  onJoint: (joint: JointSlug) => void;
  reachable: boolean;
}) {
  const { t } = useWorkshopLanguage();
  const attachment = object.cableAttachment ?? (object.slug === "cable-row-machine" ? "v-bar" : "d-handle");
  const cuff = attachment === "cuff";
  const both = !["d-handle", "cuff"].includes(attachment);
  const sides = (["left", "right"] as const).filter(side => object.attachment === side || object.attachment === "both");
  return <section aria-label={t("Cable attachment and grip")} className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
    <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{t("Cable attachment and grip")}</h2>
      <span role="img" aria-label={t("Attachment outside reach. Bring the hands closer together or adjust the arm poses.")}
        title={t("Attachment outside reach. Bring the hands closer together or adjust the arm poses.")} className={`shrink-0 text-amber-600 ${reachable ? "invisible" : ""}`}><TriangleAlert aria-hidden="true" size={20} /></span>
    </div>
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t("Cable attachment")}</legend>
      <div className="grid grid-cols-2 gap-2">{cableAttachmentSlugs.map(kind => <button type="button" key={kind}
        aria-pressed={attachment === kind && (object.slug !== "cable-row-machine" || !!object.cableAttachment)} onClick={() => onAttachment(kind)} className={buttonClass}>{t(cableAttachmentNames[kind])}</button>)}</div>
    </fieldset>
    {cuff && <label className="block text-sm font-semibold">{t("Cuff placement")}<select aria-label={t("Cuff placement")}
      value={object.cuffPosition ?? "wrist"} onChange={event => onCuffPosition(event.target.value as "wrist" | "upper-arm")}
      className="mt-1 min-h-11 w-full rounded-lg border bg-background p-2 font-normal">
      <option value="wrist">{t("At wrist")}</option><option value="upper-arm">{t("Above elbow")}</option>
    </select></label>}
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t(cuff ? "Attach cuff" : "Hold cable handle")}</legend>
      <div className="flex flex-wrap gap-2">{(["left", "right", ...(both ? ["both"] : [])] as ("left" | "right" | "both")[]).map(hand => <button type="button" key={hand}
        aria-pressed={object.attachment === hand} onClick={() => onHold(hand)} className={buttonClass}>
        {cuff ? t("Cuff {side} arm", { side: hand }) : t("Hold with {hand}", { hand: hand === "both" ? "both hands" : `${hand} hand` })}
      </button>)}</div>
    </fieldset>
    {sides.length > 0 && <>
      {!cuff && sides.map(side => <fieldset key={side} className="space-y-2">
        <legend className="text-sm font-semibold">{t(side === "left" ? "Left wrist" : "Right wrist")}</legend>
        <div className="grid grid-cols-3 gap-1">{[["Palm up", -90], ["Neutral", 0], ["Palm down", 90]].map(([name, turn]) => <button type="button" key={name}
          aria-pressed={palmTurns[side] === turn} onClick={() => onPalmTurn(side, Number(turn))} className={buttonClass}>{t(String(name))}</button>)}</div>
      </fieldset>)}
      <div className="flex flex-wrap gap-2">{sides.flatMap(side => (cuff && object.cuffPosition === "upper-arm" ? ["shoulder", "elbow"] as const : ["wrist"] as const).map(joint =>
        <button type="button" key={`${side}-${joint}`} onClick={() => onJoint(`${side}-${joint}`)} className={buttonClass}>{t(`${side === "left" ? "Left" : "Right"} ${joint}`)}</button>))}
        <button type="button" onClick={() => onHold("none")} className={buttonClass}>{t("Release")}</button>
      </div>
      <p className="text-sm text-muted-foreground">{t(cuff ? "The cuff follows the arm. Pose the shoulder and elbow freely." : "The cable follows the hand as you pose the body.")}</p>
    </>}
  </section>;
}
