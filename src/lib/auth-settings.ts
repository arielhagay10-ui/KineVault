import "server-only";

export function getAuthSettings() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP or HTTPS site origin.");
  }
  return { siteUrl: url.origin, googleEnabled: process.env.AUTH_GOOGLE_ENABLED === "true" };
}
