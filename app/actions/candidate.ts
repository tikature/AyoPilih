"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, type ActionResult, type Candidate } from "@/types";
import { requireTenantAccess, logAudit } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { candidateSchema } from "@/lib/schemas/election";

async function getElectionAccess(electionId: string) {
  const supabase = createAdminClient();
  const { data: election } = await supabase
    .from("elections")
    .select("id, tenant_id")
    .eq("id", electionId)
    .maybeSingle();

  if (!election) {
    return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");
  }

  const access = await requireTenantAccess(election.tenant_id);
  if (!access.ok) return access;

  return ok({ tenantId: election.tenant_id, access: access.data });
}

async function electionHasVotes(electionId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId);

  return (count ?? 0) > 0;
}

export async function createCandidate(
  input: z.input<typeof candidateSchema>,
): Promise<ActionResult<Candidate>> {
  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data paslon tidak valid.", "VALIDATION");
  }

  const { electionId, candidate_number, name, running_mate, short_bio, vision, mission, photo_url } = parsed.data;
  const access = await getElectionAccess(electionId);
  if (!access.ok) return access;

  if (await electionHasVotes(electionId)) {
    return fail("Paslon tidak bisa ditambah karena pemilihan sudah menerima suara.", "VALIDATION");
  }

  const supabase = createAdminClient();

  const { count } = await supabase
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId);

  const limit = PLAN_LIMITS[access.data.access.tenant.plan].maxCandidates;
  if ((count ?? 0) >= limit) {
    return fail(
      `Paket ${PLAN_LIMITS[access.data.access.tenant.plan].label} hanya mendukung ${limit} paslon. Naik ke paket Pro untuk menambah paslon.`,
      "PLAN_LIMIT",
    );
  }

  const { data: duplicate } = await supabase
    .from("candidates")
    .select("id")
    .eq("election_id", electionId)
    .eq("candidate_number", candidate_number)
    .maybeSingle();

  if (duplicate) {
    return fail(`Nomor urut ${candidate_number} sudah dipakai paslon lain.`, "VALIDATION", "candidate_number");
  }

  const { data, error } = await supabase
    .from("candidates")
    .insert({
      election_id: electionId,
      candidate_number,
      name,
      running_mate: running_mate || null,
      short_bio: short_bio || null,
      vision: vision || null,
      mission: mission || null,
      photo_url: photo_url || null,
    })
    .select()
    .single();

  if (error) return fail("Gagal menambahkan paslon.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenantId,
    electionId,
    action: "CANDIDATE_CREATED",
    meta: { candidate_number, name },
  });

  return ok(data as unknown as Candidate);
}

export async function updateCandidate(
  candidateId: string,
  input: Omit<z.input<typeof candidateSchema>, "electionId">,
): Promise<ActionResult<Candidate>> {
  const supabase = createAdminClient();
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, election_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) return fail("Paslon tidak ditemukan.", "NOT_FOUND");

  const parsed = candidateSchema.omit({ electionId: true }).partial().safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data paslon tidak valid.", "VALIDATION");
  }

  const access = await getElectionAccess(candidate.election_id);
  if (!access.ok) return access;

  if (await electionHasVotes(candidate.election_id)) {
    return fail("Paslon tidak bisa diubah karena pemilihan sudah menerima suara.", "VALIDATION");
  }

  if (parsed.data.candidate_number) {
    const { data: duplicate } = await supabase
      .from("candidates")
      .select("id")
      .eq("election_id", candidate.election_id)
      .eq("candidate_number", parsed.data.candidate_number)
      .neq("id", candidateId)
      .maybeSingle();

    if (duplicate) {
      return fail(`Nomor urut ${parsed.data.candidate_number} sudah dipakai paslon lain.`, "VALIDATION", "candidate_number");
    }
  }

  const updates = {
    ...parsed.data,
    running_mate: parsed.data.running_mate || null,
    short_bio: parsed.data.short_bio || null,
    vision: parsed.data.vision || null,
    mission: parsed.data.mission || null,
    photo_url: parsed.data.photo_url || null,
  };

  const { data, error } = await supabase
    .from("candidates")
    .update(updates)
    .eq("id", candidateId)
    .select()
    .single();

  if (error) return fail("Gagal memperbarui paslon.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenantId,
    electionId: candidate.election_id,
    action: "CANDIDATE_UPDATED",
    meta: { candidateId },
  });

  return ok(data as unknown as Candidate);
}

export async function deleteCandidate(candidateId: string): Promise<ActionResult<void>> {
  const supabase = createAdminClient();
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, election_id, name")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) return fail("Paslon tidak ditemukan.", "NOT_FOUND");

  const access = await getElectionAccess(candidate.election_id);
  if (!access.ok) return access;

  if (await electionHasVotes(candidate.election_id)) {
    return fail("Paslon tidak bisa dihapus karena pemilihan sudah menerima suara.", "VALIDATION");
  }

  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) return fail("Gagal menghapus paslon.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenantId,
    electionId: candidate.election_id,
    action: "CANDIDATE_DELETED",
    meta: { name: candidate.name },
  });

  return ok(undefined);
}

export async function reorderCandidates(
  electionId: string,
  orders: Array<{ candidateId: string; candidateNumber: number }>,
): Promise<ActionResult<void>> {
  const access = await getElectionAccess(electionId);
  if (!access.ok) return access;

  if (await electionHasVotes(electionId)) {
    return fail("Urutan paslon tidak bisa diubah karena pemilihan sudah menerima suara.", "VALIDATION");
  }

  const numbers = orders.map((item) => item.candidateNumber);
  if (new Set(numbers).size !== numbers.length) {
    return fail("Nomor urut tidak boleh duplikat.", "VALIDATION");
  }

  const supabase = createAdminClient();
  for (const order of orders) {
    const { error } = await supabase
      .from("candidates")
      .update({ candidate_number: order.candidateNumber })
      .eq("id", order.candidateId)
      .eq("election_id", electionId);

    if (error) return fail("Gagal mengurutkan paslon.", "UNKNOWN");
  }

  await logAudit({
    tenantId: access.data.tenantId,
    electionId,
    action: "CANDIDATES_REORDERED",
    meta: { total: orders.length },
  });

  return ok(undefined);
}
