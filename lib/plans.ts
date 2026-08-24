import type { PlanType, VotingMode } from "@/types";

/**
 * Plan limits. Single source of truth — enforce these on the SERVER,
 * not just by hiding buttons. See SAAS_BUSINESS_MODEL.md §2.
 */
export interface PlanLimit {
  label: string;
  price: string;
  maxVoters: number;
  maxActiveElections: number;
  maxCandidates: number;
  maxMembers: number;
  modes: readonly VotingMode[];
  customTheme: boolean;
  whatsapp: boolean;
  email: boolean;
  pdfReport: boolean;
  customDomain: boolean;
  /** true = show the "Didukung AyoPilih" footer label */
  branding: boolean;
  auditRetentionDays: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimit> = {
  STARTER: {
    label: "Starter",
    price: "Gratis",
    maxVoters: 100,
    maxActiveElections: 1,
    maxCandidates: 5,
    maxMembers: 1,
    modes: ["ONLINE_ONLY", "OFFLINE_TPS", "HYBRID"],
    customTheme: false,
    whatsapp: false,
    email: false,
    pdfReport: false,
    customDomain: false,
    branding: true,
    auditRetentionDays: 30,
  },
  PRO: {
    label: "Pro",
    price: "Rp 299.000 / pemilihan",
    maxVoters: 2000,
    maxActiveElections: 3,
    maxCandidates: 20,
    maxMembers: 5,
    modes: ["ONLINE_ONLY", "OFFLINE_TPS", "HYBRID"],
    customTheme: true,
    whatsapp: true,
    email: true,
    pdfReport: true,
    customDomain: false,
    branding: true,
    auditRetentionDays: 365,
  },
  ENTERPRISE: {
    label: "Enterprise",
    price: "Mulai Rp 2.500.000 / tahun",
    maxVoters: Infinity,
    maxActiveElections: Infinity,
    maxCandidates: Infinity,
    maxMembers: Infinity,
    modes: ["ONLINE_ONLY", "OFFLINE_TPS", "HYBRID"],
    customTheme: true,
    whatsapp: true,
    email: true,
    pdfReport: true,
    customDomain: true,
    branding: false,
    auditRetentionDays: 1825,
  },
};

export function planAllows(plan: PlanType, feature: keyof PlanLimit): boolean {
  return PLAN_LIMITS[plan][feature] === true;
}

export function quotaMessage(
  plan: PlanType,
  used: number,
  incoming: number,
): string {
  const limit = PLAN_LIMITS[plan].maxVoters;
  const remaining = Math.max(0, limit - used);
  return `Paket ${PLAN_LIMITS[plan].label} menampung ${limit} pemilih. Saat ini sudah ada ${used} pemilih terdaftar dan file ini berisi ${incoming} baris. Naik ke paket yang lebih besar, atau unggah maksimal ${remaining} baris.`;
}

/** 0–100. Used for the quota warning banner at 80% and 100%. */
export function quotaPercentage(plan: PlanType, used: number): number {
  const limit = PLAN_LIMITS[plan].maxVoters;
  if (limit === Infinity) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
