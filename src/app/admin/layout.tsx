import { notFound, redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getIdentity();
  if (!identity) redirect("/sign-in?next=/admin");
  if (identity.role === "user") notFound();
  return <div className="min-h-screen bg-background text-foreground">
    <main className="mx-auto max-w-7xl px-6 py-9">{children}</main>
  </div>;
}
