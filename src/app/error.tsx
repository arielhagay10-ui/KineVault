"use client";

import Link from "next/link";

export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-3xl px-6 py-16">
    <section role="alert" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">This page could not be loaded</h1>
      <p className="mt-3 text-muted-foreground">Check your connection and try again.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/85">Try again</button>
        <Link href="/exercises" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Explore exercises</Link>
      </div>
    </section>
  </div>;
}
