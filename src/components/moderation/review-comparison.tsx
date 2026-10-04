import { formatReviewValue, reviewFieldLabels, type ReviewField, type ReviewPatch } from "@/lib/moderation/schema";

export function ReviewComparison({ original, comparison, title }: {
  original: ReviewPatch; comparison: ReviewPatch; title: string;
}) {
  const fields = Object.keys(reviewFieldLabels) as ReviewField[];
  const changedCount = fields.filter((field) => JSON.stringify(original[field]) !== JSON.stringify(comparison[field])).length;
  return <section className="overflow-hidden rounded-2xl border border-border bg-card">
    <div className="border-b border-border px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{changedCount} differing fields · highlighted in amber</p></div>
    <div><table className="block w-full text-left text-sm sm:table">
      <thead className="hidden bg-muted text-xs text-muted-foreground sm:table-header-group"><tr><th scope="col" className="p-4">Field</th><th scope="col" className="p-4">Submitted</th><th scope="col" className="p-4">Comparison</th></tr></thead>
      <tbody className="block sm:table-row-group">{fields.map((field) => {
        const differs = JSON.stringify(original[field]) !== JSON.stringify(comparison[field]);
        return <tr key={field} className={`block border-t border-border sm:table-row ${differs ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
          <th scope="row" className="block p-4 text-left font-medium sm:table-cell sm:w-1/5">{reviewFieldLabels[field]}{differs && <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">Different</span>}</th>
          <td className="block break-words whitespace-pre-wrap px-4 pb-4 align-top text-muted-foreground sm:table-cell sm:w-2/5 sm:p-4"><span className="mb-1 block text-xs font-semibold text-foreground sm:hidden">Submitted</span>{formatReviewValue(original[field])}</td>
          <td className="block break-words whitespace-pre-wrap px-4 pb-4 align-top text-muted-foreground sm:table-cell sm:w-2/5 sm:p-4"><span className="mb-1 block text-xs font-semibold text-foreground sm:hidden">Comparison</span>{formatReviewValue(comparison[field])}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}
