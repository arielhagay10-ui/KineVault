/** Serialize diagnostic evidence without signed URLs or shared bearer tokens. */
export function redactEvidence(value) {
  return JSON.stringify(value, (_, item) => typeof item === "string"
    ? item.replace(/([?&#](?:amp;)?(?:token|access_token|refresh_token|code|token_hash)=)[^&#"'<>\s\\]+/gi, "$1[redacted]")
      .replace(/(\/shared\/)[^/?#"'<>\s\\]+/gi, "$1[redacted]")
    : item, 2);
}
