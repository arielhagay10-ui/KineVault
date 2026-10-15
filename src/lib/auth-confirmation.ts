import { z } from "zod";

// Supabase hashes are opaque and may include a PKCE prefix. The provider verifies them.
export const confirmationSchema = z.object({
  token_hash: z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["email", "recovery"]),
});
