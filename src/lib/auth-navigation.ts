export function safeNextPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string" || !value || value.length > 2048 || !value.startsWith("/")) return fallback;
  try {
    if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
    // Decode only the path. A literal percent in a query is valid search content.
    let decoded = value.split(/[?#]/, 1)[0];
    for (let pass = 0; pass < 3; pass++) {
      if (decoded.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(decoded)) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (decoded.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(decoded)) return fallback;
    const parsed = new URL(decoded, "https://kinevault.invalid");
    if (parsed.origin !== "https://kinevault.invalid" || parsed.pathname.startsWith("//") || /^\/(?:auth|sign-in|sign-up|check-email|reset-password)(?:\/|$)/.test(parsed.pathname)) return fallback;
    const destination = new URL(value, "https://kinevault.invalid");
    if (destination.pathname.startsWith("//")) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function authPath(path: string, next?: string | null) {
  return `${path}?${new URLSearchParams({ next: safeNextPath(next) })}`;
}

/** Email templates nest the original redirect URL so its query survives email rendering. */
export function emailNextPath(redirectTo: string | undefined, siteUrl: string) {
  try {
    const destination = new URL(redirectTo ?? "");
    if (destination.origin !== new URL(siteUrl).origin || destination.pathname !== "/auth/confirm") return "/dashboard";
    return safeNextPath(destination.searchParams.get("next"));
  } catch {
    return "/dashboard";
  }
}
