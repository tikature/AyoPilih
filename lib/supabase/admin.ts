import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only allowed in:
 *   - vote submission (needs to write to `votes` and `voters` atomically)
 *   - token verification (needs to read `voters.token_hash`)
 *   - vote session management
 *   - super-admin tooling
 *
 * NEVER import this file from a Client Component, and never expose its result
 * to the browser. Every caller must authorise the request itself first.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY belum diatur. Lihat docs/ENV_SETUP.md bagian A.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
