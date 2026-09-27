"use client";

import { useActionState, useState } from "react";
import { replacePrivateShare, revokePrivateShare } from "@/app/my-exercises/share-actions";

export function SharePanel({ privateId, active }: { privateId: string; active: boolean }) {
  const [state, action, pending] = useActionState(replacePrivateShare, { url: null, error: null });
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.url) return;
    await navigator.clipboard.writeText(new URL(state.url, window.location.origin).toString());
    setCopied(true);
  }

  return (
    <section className="mt-8 rounded-2xl border border-[#dce5de] bg-white p-6">
      <h2 className="text-xl font-semibold">Share with friends</h2>
      <p className="mt-2 text-sm leading-6 text-[#65776b]">Anyone with the link can view this private exercise. It stays out of Explore, and only you can edit it.</p>
      <p className="mt-3 text-xs font-semibold text-[#5d7968]">{active ? "A share link is active." : "No active share link."}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <form action={action}>
          <input type="hidden" name="privateId" value={privateId} />
          <button disabled={pending} type="submit" className="rounded-xl bg-[#174a3e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Creating…" : active ? "Replace link" : "Create share link"}
          </button>
        </form>
        {active && <form action={revokePrivateShare} onSubmit={(event) => {
          if (!window.confirm("Revoke the current link? Friends using it will lose access.")) event.preventDefault();
        }}>
          <input type="hidden" name="privateId" value={privateId} />
          <button type="submit" className="rounded-xl border border-[#cbdace] px-4 py-2.5 text-sm font-semibold text-[#46604d]">Revoke link</button>
        </form>}
      </div>
      {state.url && active && <div className="mt-5 rounded-xl border border-[#b8dfc3] bg-[#e9f6eb] p-4">
        <p className="text-sm font-semibold text-[#276448]">New link created. Copy it now; it will not be shown again.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input readOnly aria-label="Share link" value={state.url} className="min-w-0 flex-1 rounded-lg border border-[#bfdbc6] bg-white px-3 py-2 text-sm" />
          <button type="button" onClick={copyLink} className="rounded-lg bg-[#174a3e] px-4 py-2 text-sm font-semibold text-white">{copied ? "Copied" : "Copy link"}</button>
        </div>
      </div>}
      {state.error && <p role="alert" className="mt-4 text-sm text-red-700">{state.error}</p>}
    </section>
  );
}
