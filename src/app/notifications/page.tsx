import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { markNotificationRead } from "@/app/notifications/actions";
import { getIdentity } from "@/lib/auth";
import { outcomeLabels } from "@/lib/notifications/email";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/notifications");
  const query = await searchParams;
  const page = z.coerce.number().int().min(1).max(5000).catch(1).parse(query.page);
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("id,submission_id,action,exercise_name,comment,read_at,created_at")
    .eq("user_id", identity.userId).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20);
  if (error) throw new Error("Your review updates could not be loaded");
  return <main className="min-h-screen bg-[#f7f8f5] px-6 py-10 text-[#172a27]"><div className="mx-auto max-w-3xl">
    <Link href="/dashboard" className="text-sm font-semibold text-[#28785f]">← My account</Link>
    <h1 className="mt-8 text-3xl font-semibold tracking-tight">Review updates</h1><p className="mt-3 text-sm text-[#617568]">Decisions about your community contributions.</p>
    <ol className="mt-7 space-y-4">{data?.slice(0, 20).map((item) => <li key={item.id} className={`rounded-2xl border bg-white p-5 ${item.read_at ? "border-[#dce5de]" : "border-[#87b59c]"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#28785f]">{outcomeLabels[item.action as keyof typeof outcomeLabels]}{!item.read_at ? " · Unread" : ""}</p>
      <Link href={`/submissions/${item.submission_id}`} className="mt-2 block text-lg font-semibold hover:text-[#28785f]">{item.exercise_name}</Link>
      <p className="mt-2 text-xs text-[#617568]">{new Date(item.created_at).toLocaleString()}</p>
      {item.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#526b5b]">{item.comment}</p>}
      {!item.read_at && <form action={markNotificationRead} className="mt-4"><input type="hidden" name="notificationId" value={item.id} /><button className="text-xs font-semibold text-[#28785f]">Mark as read</button></form>}
    </li>)}</ol>
    {!data?.length && <p className="mt-7 rounded-2xl border border-[#dce5de] bg-white p-6 text-sm text-[#617568]">No review updates yet.</p>}
    <nav className="mt-6 flex justify-between text-sm font-semibold text-[#28785f]" aria-label="Review update pages">
      {page > 1 ? <Link href={`/notifications?page=${page - 1}`}>← Previous</Link> : <span />}
      {(data?.length ?? 0) > 20 && <Link href={`/notifications?page=${page + 1}`}>Next →</Link>}
    </nav>
  </div></main>;
}
