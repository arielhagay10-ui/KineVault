import { Textarea } from "@/components/ui/textarea";
import { Constants } from "@/lib/database.types";
import type { ReviewOptions } from "@/lib/moderation/content";
import type { ReviewPatch } from "@/lib/moderation/schema";
import { humanLabel, reviewFieldLabels } from "@/lib/moderation/schema";
import { SelectedPrivateOptions } from "./selected-options";

const enums = Constants.public.Enums;
export const privateEnumFields = {
  difficulty: enums.exercise_difficulty, exercise_type: enums.exercise_type, mechanic: enums.exercise_mechanic,
  force_type: enums.force_type, laterality: enums.laterality, peak_resistance_position: enums.peak_resistance_position,
  classification_confidence: enums.classification_confidence,
} as const;
export const privateInstructionFields = ["setup_instructions", "execution_instructions", "form_cues", "common_mistakes", "safety_notes", "range_of_motion_notes"] as const;

export function AdvancedPrivateFields({ initial, options }: { initial?: ReviewPatch; options: ReviewOptions }) {
  const input = "mt-2 min-h-11 w-full rounded-xl border bg-card p-3 text-base";
  const taxonomies = { grip: options.grips, stance: options.stances, plane: options.planes, resistance_source: options.resistanceSources };
  return <details className="rounded-2xl border bg-card p-6"><summary className="min-h-11 cursor-pointer text-lg font-semibold">Instructions and detailed classifications (optional)</summary>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="text-base font-semibold sm:col-span-2">Aliases<Textarea name="aliases" aria-label="Aliases" maxLength={3300} rows={3}
        defaultValue={initial?.aliases.join("\n") ?? ""} placeholder="One alternate name per line." className={input} /></label>
      {Object.entries(taxonomies).map(([field, values]) => <label key={field} className="text-base font-semibold">
        {reviewFieldLabels[field as keyof typeof taxonomies]}<select name={field} aria-label={reviewFieldLabels[field as keyof typeof taxonomies]} defaultValue={initial?.[field as keyof typeof taxonomies] ?? ""} className={input}>
          <option value="">Not classified</option>{values.map((value) => <option key={value.slug} value={value.slug}>{value.name}</option>)}
        </select>
      </label>)}
      {Object.entries(privateEnumFields).map(([field, values]) => <label key={field} className="text-base font-semibold">
        {reviewFieldLabels[field as keyof typeof privateEnumFields]}<select name={field} aria-label={reviewFieldLabels[field as keyof typeof privateEnumFields]} defaultValue={initial?.[field as keyof typeof privateEnumFields] ?? (field === "peak_resistance_position" ? "unknown" : "")} className={input}>
          {field !== "peak_resistance_position" && <option value="">Not classified</option>}{values.map((value) => <option key={value} value={value}>{humanLabel(value)}</option>)}
        </select>
      </label>)}
      {(["attachments", "movement_patterns"] as const).map(field => <SelectedPrivateOptions key={field}
        title={reviewFieldLabels[field]} name={field} options={field === "attachments" ? options.attachments : options.movementPatterns}
        selected={initial?.[field] ?? []} />)}
      {privateInstructionFields.map((field) => <label key={field} className="text-base font-semibold">{reviewFieldLabels[field]}
        <Textarea name={field} aria-label={reviewFieldLabels[field]} defaultValue={initial?.[field] ?? ""} maxLength={4000} rows={3} className={input} />
      </label>)}
      <label className="text-base font-semibold sm:col-span-2">Classification notes<Textarea name="reviewer_notes" aria-label="Classification notes" maxLength={2000} rows={3}
        defaultValue={initial?.reviewer_notes ?? ""} placeholder="Describe geometry, setup dependencies, or uncertainty." className={input} /></label>
    </div>
  </details>;
}

