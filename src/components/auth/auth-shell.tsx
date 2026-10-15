import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children, footer }: {
  title: string; description?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground sm:px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="rounded text-xl font-bold tracking-[-0.05em] outline-none focus-visible:ring-2 focus-visible:ring-ring">KineVault</Link>
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 sm:p-9">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-balance">{title}</h1>
          {description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>}
          {children}
          {footer && <div className="mt-7 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm">{footer}</div>}
        </div>
        <Link href="/exercises" className="mx-auto mt-6 block w-fit rounded px-2 py-1 text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Keep exploring exercises</Link>
      </div>
    </main>
  );
}
