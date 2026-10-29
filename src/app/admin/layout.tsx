import { notFound, redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { AdminNavigation } from "@/components/ui/workspace-navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/admin");
  if (identity.role === "user") notFound();
  return <div className="min-h-screen bg-background text-foreground">
    <main className="mx-auto max-w-7xl px-6 pb-20 pt-8"><AdminNavigation admin={identity.role === "admin"} />{children}</main>
  </div>;
}
