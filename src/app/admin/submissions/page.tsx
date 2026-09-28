import Link from "next/link";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { Constants } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewQueuePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const status = z.enum(Constants.public.Enums.submission_status).catch("submitted").parse(query.status);
  const page = z.coerce.number().int().min(1).max(5000).catch(1).parse(query.page);
  const mine = query.mine === "1";
  const identity = await getIdentity();
  const supabase = await createClient();
  let request = supabase.from("exercise_submissions")
    .select("id,owner_id,status,submitted_at,assigned_reviewer_id,exercise_content!exercise_submissions_original_content_id_fkey(name,exercise_families(name))")
    .eq("status", status).order("submitted_at").order("id").range((page - 1) * 20, page * 20);
  if (mine && identity) request = request.eq("assigned_reviewer_id", identity.userId);
  const { data, error } = await request;
  if (error) throw new Error("The review queue could not be loaded");
  const rows = (data ?? []).slice(0, 20);
  const { data: profiles } = rows.length ? await supabase.from("profiles").select("user_id,display_name").in("user_id", [...new Set(rows.map((item) => item.owner_id))]) : { data: [] };
  const names = new Map((profiles ?? []).map((item) => [item.user_id, item.display_name]));
  const url = (targetPage: number) => `/admin/submissions?status=${status}&page=${targetPage}${mine ? "&mine=1" : ""}`;
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
    <form className="mt-6 flex flex-wrap items-end gap-4">
      <label className="text-sm font-semibold">Status<select name="status" defaultValue={status} className="ml-3 rounded-lg border border-[#cfdbd2] bg-white px-3 py-2">
        {Constants.public.Enums.submission_status.filter((item) => item !== "draft").map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
      </select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-[#28785f]" />Assigned to me</label>
      <button className="rounded-lg bg-[#174a3e] px-4 py-2 text-sm font-semibold text-white">Filter</button>
    </form>
    <div className="mt-7 overflow-x-auto rounded-2xl border border-[#dce5de] bg-white"><table className="w-full min-w-[620px] text-left text-sm">
      <thead className="bg-[#f0f5ef] text-xs text-[#617568]"><tr>{["Exercise", "Contributor", "Submitted", "Assignment"].map((item) => <th key={item} scope="col" className="p-4">{item}</th>)}</tr></thead>
      <tbody>{rows.map((item) => <tr key={item.id} className="border-t border-[#edf1eb]">
        <td className="p-4"><Link href={`/admin/submissions/${item.id}`} className="font-semibold text-[#28785f] hover:underline">{item.exercise_content?.name ?? "Exercise"}</Link><p className="mt-1 text-xs text-[#617568]">{item.exercise_content?.exercise_families?.name ?? "Family suggested"}</p></td>
        <td className="p-4">{names.get(item.owner_id) || `Contributor ${item.owner_id.slice(0, 8)}`}</td>
        <td className="p-4 text-[#617568]">{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "—"}</td>
        <td className="p-4 text-[#617568]">{item.assigned_reviewer_id === identity?.userId ? "You" : item.assigned_reviewer_id ? "Another reviewer" : "Unassigned"}</td>
      </tr>)}</tbody>
    </table>{!rows.length && <p className="p-8 text-sm text-[#617568]">No submissions match this queue.</p>}</div>
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Queue pages">
      {page > 1 ? <Link href={url(page - 1)} className="font-semibold text-[#28785f]">← Previous</Link> : <span />}
      <span className="text-[#617568]">Page {page}</span>
      {(data?.length ?? 0) > 20 ? <Link href={url(page + 1)} className="font-semibold text-[#28785f]">Next →</Link> : <span />}
    </nav>
  </>;
}
