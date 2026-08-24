"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, type ActionResult, type Election, type Candidate } from "@/types";
import { requireTenantAccess, requireElectionAccess, logAudit } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { electionSchema } from "@/lib/schemas/election";
import { brandingSchema } from "@/lib/schemas/branding";
import { hashPin } from "@/lib/crypto/token";

export async function createElection(
  tenantId: string,
  input: z.input<typeof electionSchema>,
): Promise<ActionResult<Election>> {
  const access = await requireTenantAccess(tenantId);
  if (!access.ok) return access;

  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const { title, slug, subtitle, description, voting_mode, start_time, end_time, time_zone, allow_abstain, show_candidates_before_login, show_public_result, kiosk_pin } = parsed.data;

  const startDate = new Date(start_time);
  const endDate = new Date(end_time);
  if (endDate <= startDate) {
    return fail("Waktu selesai harus lebih besar dari waktu mulai.", "VALIDATION", "end_time");
  }

  const supabase = createAdminClient();

  const { data: existingElections } = await supabase
    .from("elections")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["DRAFT", "SCHEDULED", "ONGOING"]);

  const activeCount = existingElections?.length ?? 0;
  const limit = PLAN_LIMITS[access.data.tenant.plan].maxActiveElections;

  if (activeCount >= limit) {
    return fail(
      `Paket ${PLAN_LIMITS[access.data.tenant.plan].label} hanya boleh ${limit} pemilihan aktif. Naik paket untuk menambah kapasitas.`,
      "PLAN_LIMIT",
    );
  }

  const allowedModes = PLAN_LIMITS[access.data.tenant.plan].modes;
  if (!allowedModes.includes(voting_mode)) {
    return fail(
      `Mode ${voting_mode} tidak tersedia di paket ${PLAN_LIMITS[access.data.tenant.plan].label}. Naik ke paket Pro untuk mengaktifkan mode TPS dan Hybrid.`,
      "PLAN_LIMIT",
    );
  }

  const { data: existingSlug } = await supabase
    .from("elections")
    .select("slug")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .maybeSingle();

  if (existingSlug) {
    return fail(`Slug "${slug}" sudah dipakai di pemilihan lain.`, "VALIDATION", "slug");
  }

  const startUtc = new Date(startDate.toLocaleString("en-US", { timeZone: time_zone }));
  const endUtc = new Date(endDate.toLocaleString("en-US", { timeZone: time_zone }));

  const kioskPinHash = kiosk_pin ? await hashPin(kiosk_pin) : null;

  const { data: election, error } = await supabase
    .from("elections")
    .insert({
      tenant_id: tenantId,
      title,
      slug,
      subtitle: subtitle || null,
      description: description || null,
      voting_mode,
      start_time: startUtc.toISOString(),
      end_time: endUtc.toISOString(),
      allow_abstain,
      show_candidates_before_login,
      show_public_result,
      kiosk_pin_hash: kioskPinHash,
      status: "DRAFT",
    })
    .select()
    .single();

  if (error) {
    return fail("Gagal membuat pemilihan. Coba lagi sebentar.", "UNKNOWN");
  }

  await logAudit({
    tenantId,
    electionId: election.id,
    action: "ELECTION_CREATED",
    meta: { title, slug },
  });

  return ok(election as unknown as Election);
}

export async function updateElection(
  electionId: string,
  input: Partial<z.input<typeof electionSchema>>,
): Promise<ActionResult<Election>> {
  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, tenant_id, status")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  const { data: voteCount } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId);

  const hasVotes = (voteCount?.length ?? 0) > 0;

  if (hasVotes) {
    const allowedUpdates: Partial<z.input<typeof electionSchema>> = {};
    if (input.show_public_result !== undefined) allowedUpdates.show_public_result = input.show_public_result;
    if (input.show_candidates_before_login !== undefined) allowedUpdates.show_candidates_before_login = input.show_candidates_before_login;

    if (Object.keys(allowedUpdates).length === 0) {
      return fail(
        "Pemilihan yang sudah menerima suara tidak bisa diubah jadwal atau modenya. Hanya pengaturan tampilan yang dapat dimodifikasi.",
        "VALIDATION",
      );
    }

    const { data: updated, error } = await supabase
      .from("elections")
      .update(allowedUpdates)
      .eq("id", electionId)
      .select()
      .single();

    if (error) return fail("Gagal memperbarui pemilihan.", "UNKNOWN");
    return ok(updated as unknown as Election);
  }

  const parsed = electionSchema.partial().safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  delete updates.kiosk_pin;

  if (parsed.data.kiosk_pin) {
    updates.kiosk_pin_hash = await hashPin(parsed.data.kiosk_pin);
  } else if (parsed.data.kiosk_pin === "") {
    updates.kiosk_pin_hash = null;
  }

  if (input.start_time && input.end_time) {
    const startDate = new Date(input.start_time);
    const endDate = new Date(input.end_time);
    if (endDate <= startDate) {
      return fail("Waktu selesai harus lebih besar dari waktu mulai.", "VALIDATION", "end_time");
    }
    const time_zone = input.time_zone || "Asia/Jakarta";
    updates.start_time = new Date(startDate.toLocaleString("en-US", { timeZone: time_zone })).toISOString();
    updates.end_time = new Date(endDate.toLocaleString("en-US", { timeZone: time_zone })).toISOString();
  }

  if (input.voting_mode) {
    const allowedModes = PLAN_LIMITS[access.data.tenant.plan].modes;
    if (!allowedModes.includes(input.voting_mode)) {
      return fail(
        `Mode ${input.voting_mode} tidak tersedia di paket ${PLAN_LIMITS[access.data.tenant.plan].label}.`,
        "PLAN_LIMIT",
      );
    }
  }

  const { data: updated, error } = await supabase
    .from("elections")
    .update(updates)
    .eq("id", electionId)
    .select()
    .single();

  if (error) return fail("Gagal memperbarui pemilihan.", "UNKNOWN");

  await logAudit({
    tenantId: election.tenant_id,
    electionId,
    action: "ELECTION_UPDATED",
    meta: { changes: Object.keys(updates) },
  });

  return ok(updated as unknown as Election);
}

export async function deleteElection(electionId: string): Promise<ActionResult<void>> {
  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, tenant_id, title, status")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  const { data: voteCount } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId);

  if ((voteCount?.length ?? 0) > 0) {
    return fail("Pemilihan yang sudah menerima suara tidak bisa dihapus untuk menjaga integritas data.", "VALIDATION");
  }

  const { error } = await supabase.from("elections").delete().eq("id", electionId);

  if (error) return fail("Gagal menghapus pemilihan.", "UNKNOWN");

  await logAudit({
    tenantId: election.tenant_id,
    action: "ELECTION_DELETED",
    meta: { title: election.title },
  });

  return ok(undefined);
}

export async function publishElection(electionId: string): Promise<ActionResult<Election>> {
  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, tenant_id, title, status, start_time")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  if (election.status !== "DRAFT") {
    return fail("Hanya pemilihan berstatus draft yang bisa dipublikasikan.", "VALIDATION");
  }

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id")
    .eq("election_id", electionId);

  if (!candidates || candidates.length < 2) {
    return fail("Pemilihan harus memiliki minimal 2 paslon sebelum dipublikasikan.", "VALIDATION");
  }

  const now = new Date();
  const startTime = new Date(election.start_time);
  const status = startTime > now ? "SCHEDULED" : "ONGOING";

  const { data: updated, error } = await supabase
    .from("elections")
    .update({ status })
    .eq("id", electionId)
    .select()
    .single();

  if (error) return fail("Gagal mempublikasikan pemilihan.", "UNKNOWN");

  await logAudit({
    tenantId: election.tenant_id,
    electionId,
    action: "ELECTION_PUBLISHED",
    meta: { status },
  });

  return ok(updated as unknown as Election);
}

export async function closeElection(electionId: string): Promise<ActionResult<Election>> {
  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("id, tenant_id, title, status")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  if (election.status === "CLOSED") {
    return fail("Pemilihan sudah ditutup.", "VALIDATION");
  }

  const { data: updated, error } = await supabase
    .from("elections")
    .update({ status: "CLOSED" })
    .eq("id", electionId)
    .select()
    .single();

  if (error) return fail("Gagal menutup pemilihan.", "UNKNOWN");

  await logAudit({
    tenantId: election.tenant_id,
    electionId,
    action: "ELECTION_CLOSED",
  });

  return ok(updated as unknown as Election);
}

export async function getElections(tenantId: string): Promise<ActionResult<Election[]>> {
  const access = await requireTenantAccess(tenantId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elections")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return fail("Gagal mengambil data pemilihan.", "UNKNOWN");
  return ok((data ?? []) as unknown as Election[]);
}

export async function getElection(electionId: string): Promise<ActionResult<Election & { candidates: Candidate[] }>> {
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("*, candidates(*)")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  return ok(election as unknown as Election & { candidates: Candidate[] });
}

// ─────────────────────────────────────────────────────────────────
// updateElectionBranding — save landing page customization
// ─────────────────────────────────────────────────────────────────
export async function updateElectionBranding(
  input: z.input<typeof brandingSchema>,
): Promise<ActionResult<Election>> {
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const { electionId, title, subtitle, description, banner_url, timeline, contact_info, show_candidates_before_login, show_public_result } = parsed.data;

  const access = await requireElectionAccess(electionId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("elections")
    .update({
      title,
      subtitle: subtitle || null,
      description: description || null,
      banner_url: banner_url || null,
      timeline: timeline || [],
      contact_info: contact_info || null,
      show_candidates_before_login,
      show_public_result,
    })
    .eq("id", electionId)
    .select()
    .single();

  if (error) return fail("Gagal menyimpan branding pemilihan.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId,
    action: "ELECTION_BRANDING_UPDATED",
    meta: { fields: ["title", "banner_url", "timeline", "contact_info"] },
  });

  return ok(updated as unknown as Election);
}
