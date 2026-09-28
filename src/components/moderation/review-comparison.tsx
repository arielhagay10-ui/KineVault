import { formatReviewValue, reviewFieldLabels, type ReviewField, type ReviewPatch } from "@/lib/moderation/schema";

export function ReviewComparison({ original, comparison, title }: {
  original: ReviewPatch; comparison: ReviewPatch; title: string;
}) {
  const fields = Object.keys(reviewFieldLabels) as ReviewField[];
  const changedCount = fields.filter((field) => JSON.stringify(original[field]) !== JSON.stringify(comparison[field])).length;
  return <section className="overflow-hidden rounded-2xl border border-[#dce5de] bg-white">
    <div className="border-b border-[#dce5de] px-5 py-4"><h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-[#617568]">{changedCount} differing fields · highlighted in amber</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm">
      <thead className="bg-[#f0f5ef] text-xs text-[#617568]"><tr><th scope="col" className="p-4">Field</th><th scope="col" className="p-4">Submitted</th><th scope="col" className="p-4">Comparison</th></tr></thead>
      <tbody>{fields.map((field) => {
        const differs = JSON.stringify(original[field]) !== JSON.stringify(comparison[field]);
        return <tr key={field} className={`border-t border-[#edf1eb] ${differs ? "bg-amber-50" : ""}`}>
          <th scope="row" className="w-1/5 p-4 font-medium">{reviewFieldLabels[field]}{differs && <span className="mt-1 block text-xs text-amber-800">Different</span>}</th>
          <td className="w-2/5 whitespace-pre-wrap p-4 align-top text-[#526b5b]">{formatReviewValue(original[field])}</td>
          <td className="w-2/5 whitespace-pre-wrap p-4 align-top text-[#526b5b]">{formatReviewValue(comparison[field])}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}
