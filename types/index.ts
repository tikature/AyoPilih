// =====================================================================
// AYOPILIH — SHARED TYPES
// Keep this file the single source of truth. Do not redeclare these
// shapes elsewhere.
// =====================================================================

// ---------- Enums (mirror DATABASE_SCHEMA.sql) ----------
export type PlanType = "STARTER" | "PRO" | "ENTERPRISE";
export type MemberRole = "OWNER" | "ADMIN" | "VIEWER";
export type VotingMode = "ONLINE_ONLY" | "OFFLINE_TPS" | "HYBRID";
export type ElectionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ONGOING"
  | "CLOSED"
  | "ARCHIVED";
export type VoterStatus = "UNINVITED" | "SENT" | "VOTED" | "BLOCKED";

// ---------- Entities ----------
export interface Tenant {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  institution: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  theme_color: string;
  plan: PlanType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface TimelineItem {
  label: string; // "Masa Kampanye"
  start: string; // ISO date
  end: string; // ISO date
  description?: string;
}

export interface Election {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  banner_url: string | null;
  timeline: TimelineItem[];
  contact_info: string | null;
  voting_mode: VotingMode;
  status: ElectionStatus;
  start_time: string;
  end_time: string;
  kiosk_pin_hash: string | null;
  show_candidates_before_login: boolean;
  show_public_result: boolean;
  allow_abstain: boolean;
  max_voters: number | null;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  election_id: string;
  candidate_number: number;
  name: string;
  running_mate: string | null;
  short_bio: string | null;
  vision: string | null;
  mission: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Voter {
  id: string;
  election_id: string;
  identifier: string;
  name: string;
  group_name: string | null;
  email: string | null;
  phone: string | null;
  token_hash: string | null;
  status: VoterStatus;
  has_voted: boolean;
  voted_at: string | null;
  created_at: string;
}

/** Never contains anything that links back to a voter. See SECURITY.md §2. */
export interface Vote {
  id: string;
  election_id: string;
  candidate_id: string | null;
  vote_hash: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  election_id: string | null;
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
}

// ---------- Server Action result envelope ----------
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string; code?: ActionErrorCode };

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "PLAN_LIMIT"
  | "ALREADY_VOTED"
  | "VOTER_BLOCKED"
  | "ELECTION_NOT_OPEN"
  | "OUTSIDE_VOTING_WINDOW"
  | "INVALID_TOKEN"
  | "RATE_LIMITED"
  | "SESSION_EXPIRED"
  | "UNKNOWN";

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (
  error: string,
  code: ActionErrorCode = "UNKNOWN",
  field?: string,
): ActionResult<never> => ({ ok: false, error, code, field });

// ---------- View models ----------
export interface LiveCountRow {
  candidate_id: string;
  candidate_number: number;
  name: string;
  total: number;
}

export interface Turnout {
  total_voters: number;
  voted: number;
  percentage: number;
}

/** Aggregate per-bucket count of votes for the velocity chart. */
export interface VelocityBucket {
  bucket_start: string;
  total: number;
}

/** Photo metadata for a candidate. Fetched separately from get_live_count()
 *  to avoid changing that RPC's signature. */
export interface CandidatePhoto {
  id: string;
  candidate_number: number;
  photo_url: string | null;
}

export interface ElectionWithCandidates extends Election {
  candidates: Candidate[];
  tenant: Pick<Tenant, "name" | "slug" | "logo_url" | "theme_color" | "plan">;
}

/** Result of parsing an uploaded DPT file, shown on the preview screen. */
export interface VoterImportRow {
  rowNumber: number;
  identifier: string;
  name: string;
  group_name?: string;
  email?: string;
  phone?: string;
}

export interface VoterImportRejection {
  rowNumber: number;
  raw: Record<string, string>;
  reason: string;
}

export interface VoterImportPreview {
  valid: VoterImportRow[];
  rejected: VoterImportRejection[];
  totalRows: number;
  quotaRemaining: number;
}

/** Returned exactly once after generating tokens. Never persisted. */
export interface GeneratedToken {
  voterId: string;
  identifier: string;
  name: string;
  group_name: string | null;
  token: string;
}

/** Public receipt lookup result — deliberately omits the chosen candidate. */
export interface ReceiptCheck {
  recorded: boolean;
  electionTitle?: string;
  tenantName?: string;
  recordedAt?: string;
}
