"use client";

import { useEffect, useState } from "react";

export function CooldownSubmit({ retryAt = 0, initialSeconds, pending, label, pendingLabel }: {
  retryAt?: number; initialSeconds?: number; pending: boolean; label: string; pendingLabel: string;
}) {
  const [remaining, setRemaining] = useState(() => initialSeconds ?? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  return (
    <button type="submit" disabled={pending || remaining > 0}
      className="min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? pendingLabel : remaining > 0 ? `Resend available in ${remaining}s` : label}
    </button>
  );
}
