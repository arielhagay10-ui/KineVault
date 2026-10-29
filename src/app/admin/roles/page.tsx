import { notFound } from "next/navigation";
import { z } from "zod";
import { RoleForm } from "@/components/moderation/admin-forms";
import { ListPagination } from "@/components/catalog/list-pagination";
import { parseListPage } from "@/lib/search/list-page";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageState, secondaryActionClass } from "@/components/ui/page-layout";

export default async function RolesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getIdentity())?.role !== "admin") notFound();
  const query = await searchParams;
  const { page, from, to } = parseListPage(query);
  const roleFilter = z.enum(["reviewer", "admin"]).safeParse(query.q);
  const userId = z.uuid().safeParse(query.user);
  const supabase = await createClient();
  let request = supabase.from("roles").select("user_id,role,assigned_at", { count: "exact" }).neq("role", "user");
  if (roleFilter.success) request = request.eq("role", roleFilter.data);
  const { data: roles, error, count } = await request.order("assigned_at", { ascending: false }).order("user_id").range(from, to);
  if (error) throw new Error("Account roles could not be loaded");
  return <>
    <PageHeader title="Account roles" description="Role changes are audited. The final admin cannot be demoted." />
    <form method="get" className="flex flex-wrap items-center gap-3">
      <label htmlFor="role-filter" className="text-sm font-semibold">Filter roles</label>
      <select id="role-filter" name="q" defaultValue={roleFilter.success ? roleFilter.data : ""} className="min-h-11 rounded-xl border bg-card px-3 text-sm">
        <option value="">All reviewers and admins</option><option value="reviewer">Reviewers</option><option value="admin">Admins</option>
      </select>
      <button className={secondaryActionClass}>Apply</button>
    </form>
    <div className="mt-7 grid gap-6 md:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-border bg-card p-5"><h2 className="mb-5 text-lg font-semibold">Assign a role</h2><RoleForm userId={userId.success ? userId.data : ""} /></section>
      <section className="min-w-0 rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Recent reviewers and admins</h2><ul className="mt-4 divide-y divide-border">{roles?.map((item) => <li key={item.user_id} className="py-3">
        <p className="text-sm font-semibold capitalize">{item.role}</p><p className="mt-1 break-all text-xs text-muted-foreground">{item.user_id}</p>
      </li>)}</ul>{!roles?.length && <div className="mt-4"><PageState title="No roles on this page" description="Change the filter or return to the first page." /></div>}<ListPagination path="/admin/roles" page={page} total={count ?? 0} query={roleFilter.success ? roleFilter.data : ""} /></section>
    </div>
  </>;
}
