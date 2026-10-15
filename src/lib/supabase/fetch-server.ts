import "server-only";

/** Route server traffic internally while keeping public auth and media URLs stable. */
export const fetchSupabase: typeof fetch = (input, init) => {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const internalUrl = process.env.SUPABASE_URL_INTERNAL?.replace(/\/$/, "");
  const requestUrl = input instanceof Request ? input.url : String(input);

  if (!publicUrl || !internalUrl || !requestUrl.startsWith(`${publicUrl}/`)) {
    return fetch(input, init);
  }

  const target = `${internalUrl}${requestUrl.slice(publicUrl.length)}`;
  return fetch(input instanceof Request ? new Request(target, input) : target, init);
};
