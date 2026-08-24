/**
 * Route builders for tenant space.
 *
 * THE RULE
 * --------
 * Inside app/tenant/, the tenant slug lives in the SUBDOMAIN, not the path.
 * The browser sees:            sma5.ayopilih.id/haha/bilik
 * Middleware rewrites it to:   /tenant/sma5/haha/bilik   (internal only)
 *
 * So `params.slug` exists in components, but it is for FETCHING DATA ONLY.
 * Never put it in an href or a redirect — that produces /sma5/haha/bilik,
 * which 404s.
 *
 * Every link and redirect inside tenant space must go through this file.
 * Manual string concatenation of paths is forbidden (see AGENTS.md).
 */

// ---------------------------------------------------------------------
// Voter-facing routes (relative — stay on the current subdomain)
// ---------------------------------------------------------------------

/** Tenant home: list of that organisation's elections. */
export const tenantHome = () => "/";

/** Election landing page (profile, description, candidates, countdown). */
export const electionHome = (electionSlug: string) => `/${electionSlug}`;

/** Full vision & mission of every candidate. */
export const electionCandidates = (electionSlug: string) =>
  `/${electionSlug}/paslon`;

/** Token entry screen. */
export const electionLogin = (electionSlug: string) =>
  `/${electionSlug}/masuk`;

/** Voting booth — requires a booth session cookie. */
export const electionBooth = (electionSlug: string) =>
  `/${electionSlug}/bilik`;

/** Receipt screen shown right after the vote is cast. */
export const electionDone = (electionSlug: string) =>
  `/${electionSlug}/selesai`;

/** Public live count (only when show_public_result is true). */
export const electionResult = (electionSlug: string) =>
  `/${electionSlug}/hasil`;

/** Kiosk mode for OFFLINE_TPS. */
export const electionKiosk = (electionSlug: string) =>
  `/${electionSlug}/kios`;

/** Shown when a token has already been used. */
export const electionAlreadyVoted = (electionSlug: string) =>
  `/${electionSlug}/sudah-memilih`;

// ---------------------------------------------------------------------
// Admin routes (also relative — same subdomain, no slug in the path)
// ---------------------------------------------------------------------

export const adminHome = () => "/admin";
export const adminElections = () => "/admin/pemilihan";
export const adminElection = (electionId: string) =>
  `/admin/pemilihan/${electionId}`;
export const adminCandidates = () => `/admin/paslon`;
export const adminCandidatesByElection = (electionId: string) =>
  `/admin/paslon?election=${electionId}`;
export const adminVoters = () => `/admin/dpt`;
export const adminVotersByElection = (electionId: string) =>
  `/admin/dpt?election=${electionId}`;
export const adminBranding = (electionId: string) =>
  `/admin/tampilan?election=${electionId}`;
export const adminMonitor = (electionId: string) =>
  `/admin/pemilihan/${electionId}/monitor`;
export const adminReports = (electionId: string) =>
  `/admin/pemilihan/${electionId}/laporan`;
export const adminSettings = () => "/admin/pengaturan";

// ---------------------------------------------------------------------
// Cross-domain routes (absolute — these DO need the slug, because they
// cross from the root domain into a subdomain or vice versa)
// ---------------------------------------------------------------------

function rootDomain(): { protocol: string; host: string } {
  const host = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  return { protocol: host.includes("localhost") ? "http" : "https", host };
}

/** Absolute URL into a tenant, e.g. for emails, WhatsApp, or QR codes. */
export function absoluteTenantUrl(slug: string, path = ""): string {
  const { protocol, host } = rootDomain();
  return `${protocol}://${slug}.${host}${path}`;
}

/** The link a voter receives along with their token. */
export const voterInviteUrl = (slug: string, electionSlug: string) =>
  absoluteTenantUrl(slug, electionLogin(electionSlug));

/** Marketing / root-domain pages, reachable from inside a tenant. */
export function rootUrl(path = ""): string {
  const { protocol, host } = rootDomain();
  return `${protocol}://${host}${path}`;
}

export const loginUrl = () => rootUrl("/masuk");
export const registerUrl = () => rootUrl("/daftar");
export const pricingUrl = () => rootUrl("/harga");
export const receiptCheckUrl = () => rootUrl("/cek");
