import { notFound } from "next/navigation";
import { z } from "zod";
import { RoleForm } from "@/components/moderation/admin-forms";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function RolesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getIdentity())?.role !== "admin") notFound();
  const query = await searchParams;
  const userId = z.uuid().safeParse(query.user);
  const supabase = await createClient();
  const { data: roles, error } = await supabase.from("roles").select("user_id,role,assigned_at").neq("role", "user").order("assigned_at", { ascending: false }).limit(50);
  if (error) throw new Error("Account roles could not be loaded");
  return <>
    <h1 className="text-3xl font-semibold tracking-tight">Account roles</h1>
    <p className="mt-3 text-sm text-muted-foreground">Role changes are audited. The final admin cannot be demoted.</p>
    <div className="mt-7 grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="mb-5 text-lg font-semibold">Assign a role</h2><RoleForm userId={userId.success ? userId.data : ""} /></section>
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Recent reviewers and admins</h2><ul className="mt-4 space-y-4">{roles?.map((item) => <li key={item.user_id}>
        <p className="text-sm font-semibold capitalize">{item.role}</p><p className="mt-1 break-all text-xs text-muted-foreground">{item.user_id}</p>
      </li>)}</ul></section>
    </div>
  </>;
}
