import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/admin");
  if (identity.role === "user") notFound();
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
      <Link href="/admin" className="text-xl font-bold tracking-tight">KineVault <span className="text-sm font-normal text-muted-foreground">Review</span></Link>
      <nav className="flex flex-wrap gap-5 text-sm font-medium" aria-label="Administration">
        <Link href="/admin/submissions">Review queue</Link>
        <Link href="/admin/exercises">Published exercises</Link>
        <Link href="/admin/candidates">Catalog candidates</Link>
        {identity.role === "admin" && <Link href="/admin/taxonomies">Taxonomies</Link>}
        {identity.role === "admin" && <><Link href="/admin/assets">Assets</Link><Link href="/admin/roles">Roles</Link></>}
        <Link href="/dashboard">My account</Link><Link href="/exercises">Explore</Link>
      </nav>
    </div></header>
    <main className="mx-auto max-w-7xl px-6 py-9">{children}</main>
  </div>;
}
