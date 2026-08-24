import "server-only";

/**
 * Voter token utilities.
 *
 * Rules (see SECURITY.md §4):
 *  - Tokens are 8 chars from an unambiguous alphabet (no 0/O/1/I/L).
 *  - Generated with crypto.getRandomValues, never Math.random.
 *  - Only SHA-256(token + ":" + TOKEN_PEPPER) is ever stored.
 *  - The plaintext token is returned exactly once, to the panitia, and is never
 *    logged or persisted.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 chars
const TOKEN_LENGTH = 8;

function getPepper(): string {
  const pepper = process.env.TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error(
      "TOKEN_PEPPER belum diatur atau terlalu pendek (minimal 32 karakter). Lihat docs/ENV_SETUP.md bagian C.",
    );
  }
  return pepper;
}

/** Generates one voter token, e.g. "K7M2QX9B". */
export function generateToken(): string {
  const bytes = new Uint32Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);

  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    // Rejection-free modulo bias is negligible here (2^32 % 31), and tokens are
    // rate-limited server side, so a uniform-enough draw is acceptable.
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Generates `count` distinct tokens. */
export function generateTokens(count: number): string[] {
  const set = new Set<string>();
  while (set.size < count) set.add(generateToken());
  return [...set];
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hashes a voter token for storage/lookup. Input is normalised first. */
export function hashToken(token: string): Promise<string> {
  return sha256Hex(`${normalizeToken(token)}:${getPepper()}`);
}

/** Uppercases and strips separators so "k7m2-qx9b" matches "K7M2QX9B". */
export function normalizeToken(token: string): string {
  return token.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Cheap client-side-safe shape check before hitting the database. */
export function isValidTokenFormat(token: string): boolean {
  const t = normalizeToken(token);
  if (t.length !== TOKEN_LENGTH) return false;
  return [...t].every((c) => ALPHABET.includes(c));
}

/** Hashes a kiosk PIN (6 digits) with the same pepper. */
export function hashPin(pin: string): Promise<string> {
  return sha256Hex(`pin:${pin}:${getPepper()}`);
}

/**
 * Builds a vote receipt hash. Contains no voter information whatsoever —
 * just the election and 32 random bytes.
 */
export async function generateVoteHash(electionId: string): Promise<string> {
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  const nonceHex = [...nonce]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return sha256Hex(`${electionId}:${nonceHex}`);
}

/** Formats a raw hash into the human-facing receipt code: AYP-4F2C-9K1D-B7E3. */
export function formatReceipt(voteHash: string): string {
  const s = voteHash.toUpperCase().replace(/[^A-F0-9]/g, "");
  return `AYP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** Creates an opaque session token for the voting booth cookie. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hashes a booth session token before storing it in vote_sessions. */
export function hashSessionToken(sessionToken: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET belum diatur. Lihat docs/ENV_SETUP.md bagian C.",
    );
  }
  return sha256Hex(`${sessionToken}:${secret}`);
}
