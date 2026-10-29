import Link from "next/link";
import { LibraryNavigation } from "@/components/ui/workspace-navigation";
import { redirect } from "next/navigation";
import { z } from "zod";
import { markNotificationRead } from "@/app/notifications/actions";
import { getIdentity } from "@/lib/auth";
import { outcomeLabels } from "@/lib/notifications/email";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

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
  return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
    <LibraryNavigation />
    <PageHeader title="Review updates" description="Decisions about your community contributions." back={{ href: "/dashboard", label: "Your library" }} />
    <ol className="space-y-4">{data?.slice(0, 20).map((item) => <li key={item.id} className={`rounded-xl border bg-card p-5 ${item.read_at ? "border-border" : "border-primary"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{outcomeLabels[item.action as keyof typeof outcomeLabels]}{!item.read_at ? " · Unread" : ""}</p>
      <Link href={`/submissions/${item.submission_id}`} className="mt-2 block text-lg font-semibold hover:text-primary">{item.exercise_name}</Link>
      <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
      {item.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.comment}</p>}
      {!item.read_at && <form action={markNotificationRead} className="mt-4"><input type="hidden" name="notificationId" value={item.id} /><button className="min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline">Mark as read</button></form>}
    </li>)}</ol>
    {!data?.length && <PageState title="No review updates yet" description="Decisions about your community contributions will appear here."><Link href="/submissions" className={secondaryActionClass}>My submissions</Link></PageState>}
    <nav className="mt-6 flex justify-between text-sm font-semibold text-primary" aria-label="Review update pages">
      {page > 1 ? <Link href={`/notifications?page=${page - 1}`} className={secondaryActionClass}>Previous</Link> : <span />}
      {(data?.length ?? 0) > 20 && <Link href={`/notifications?page=${page + 1}`} className={secondaryActionClass}>Next</Link>}
    </nav>
  </div></main>;
}
