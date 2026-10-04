"use client";

import { useActionState, useState } from "react";
import { replacePrivateShare, revokePrivateShare } from "@/app/my-exercises/share-actions";

export function SharePanel({ privateId, active }: { privateId: string; active: boolean }) {
  const [state, action, pending] = useActionState(replacePrivateShare, { url: null, error: null });
  const [copyState, setCopyState] = useState<{ url: string; error: boolean } | null>(null);
  const copied = copyState?.url === state.url && !copyState.error;

  async function copyLink() {
    if (!state.url) return;
    const url = state.url;
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      setCopyState({ url, error: false });
    } catch { setCopyState({ url, error: true }); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Share with friends</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Anyone with the link can view this private exercise. It stays out of Explore, and only you can edit it.</p>
      <p className="mt-3 text-xs font-semibold text-muted-foreground">{active ? "A share link is active." : "No active share link."}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <form action={action}>
          <input type="hidden" name="privateId" value={privateId} />
          <button disabled={pending} type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {pending ? "Creating…" : active ? "Replace link" : "Create share link"}
          </button>
        </form>
        {active && <form action={revokePrivateShare} onSubmit={(event) => {
          if (!window.confirm("Revoke the current link? Friends using it will lose access.")) event.preventDefault();
        }}>
          <input type="hidden" name="privateId" value={privateId} />
          <button type="submit" className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground">Revoke link</button>
        </form>}
      </div>
      {state.url && active && <div className="mt-5 rounded-xl border border-border bg-muted p-4">
        <p className="text-sm font-semibold text-primary">New link created. Copy it now; it will not be shown again.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input readOnly aria-label="Share link" value={state.url} className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <button type="button" onClick={copyLink} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85">{copied ? "Copied" : "Copy link"}</button>
        </div>
        {copyState?.url === state.url && <p role={copyState.error ? "alert" : "status"} className={`mt-3 text-sm ${copyState.error ? "text-destructive" : "text-primary"}`}>
          {copyState.error ? "Could not copy. Select the link and copy it manually." : "Share link copied."}
        </p>}
      </div>}
      {state.error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    </section>
  );
}
