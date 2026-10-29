import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@/components/ui/icons";

export const primaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryActionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

/** Shared reading hierarchy for catalog, library, and administration pages. */
export function PageHeader({ title, description, back, actions }: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return <header className="mb-8 border-b border-border pb-7">
    {back && <Link href={back.href} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"><ArrowLeft size={14} />{back.label}</Link>}
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="min-w-0 max-w-3xl flex-1 basis-72">
        <h1 className="break-words text-[2rem] font-semibold leading-tight tracking-[-0.025em] text-balance">{title}</h1>
        {description && <div className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.65] text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>;
}

export function PageState({ title, description, children, error = false }: {
  title: string;
  description?: string;
  children?: ReactNode;
  error?: boolean;
}) {
  return <section role={error ? "alert" : undefined} className={`rounded-xl border bg-card px-6 py-12 sm:px-8 ${error ? "border-destructive/40" : "border-dashed border-border"}`}>
    <div className="mx-auto max-w-lg text-center">
      <h2 className="text-xl font-semibold leading-snug text-balance">{title}</h2>
      {description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  </section>;
}
