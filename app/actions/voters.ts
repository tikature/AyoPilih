"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireElectionAccess, logAudit } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { generateTokens, hashToken } from "@/lib/crypto/token";
import { adminVotersByElection } from "@/lib/routes";
import { voterFormSchema } from "@/lib/schemas/voter";
import {
  ok,
  fail,
  type ActionResult,
  type Voter,
  type VoterImportPreview,
  type VoterImportRow,
  type VoterImportRejection,
  type GeneratedToken,
} from "@/types";

const MAX_ROWS = 20_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** Accepts 08xx, 8xx, +62xx, 62xx and returns +628xx. Returns null if unusable. */
function normalizePhone(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;
  let n = digits;
  if (n.startsWith("62")) n = n.slice(2);
  else if (n.startsWith("0")) n = n.slice(1);
  if (n.length < 8 || n.length > 13) return null;
  return `+62${n}`;
}

/** Prevents CSV injection when the data is exported again later. */
function sanitizeCell(value: string): string {
  const v = value.trim();
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === key.toLowerCase(),
    );
    if (found && row[found]) return String(row[found]).trim();
  }
  return "";
}

// ---------------------------------------------------------------------
// parseVoterFile — returns a preview, writes nothing
// ---------------------------------------------------------------------
export async function parseVoterFile(
  formData: FormData,
): Promise<ActionResult<VoterImportPreview>> {
  const electionId = String(formData.get("electionId") ?? "");
  const file = formData.get("file");

  if (!z.string().uuid().safeParse(electionId).success) {
    return fail("Pemilihan tidak valid.", "VALIDATION");
  }
  if (!(file instanceof File)) {
    return fail("File belum dipilih.", "VALIDATION", "file");
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("Ukuran file melebihi 5 MB. Pecah menjadi beberapa file.", "VALIDATION", "file");
  }

  const access = await requireElectionAccess(electionId);
  if (!access.ok) return access;

  // --- Read rows ---
  let rows: Record<string, string>[] = [];
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = await file.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      rows = result.data;
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
        raw: false,
      });
    } else {
      return fail("Format file harus CSV atau XLSX.", "VALIDATION", "file");
    }
  } catch {
    return fail("File tidak bisa dibaca. Pastikan formatnya CSV atau XLSX yang benar.", "VALIDATION", "file");
  }

  if (rows.length === 0) {
    return fail("File tidak berisi data. Unduh template lalu isi minimal satu baris.", "VALIDATION", "file");
  }
  if (rows.length > MAX_ROWS) {
    return fail(`File berisi ${rows.length} baris, melebihi batas ${MAX_ROWS}.`, "VALIDATION", "file");
  }

  // --- Existing identifiers, so duplicates against the database are caught too ---
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("voters")
    .select("identifier")
    .eq("election_id", electionId);

  const seen = new Set((existing ?? []).map((v) => v.identifier.toLowerCase()));
  const currentCount = existing?.length ?? 0;

  const plan = access.data.tenant.plan;
  const quota = PLAN_LIMITS[plan].maxVoters;
  const quotaRemaining =
    quota === Infinity ? Number.MAX_SAFE_INTEGER : Math.max(0, quota - currentCount);

  const valid: VoterImportRow[] = [];
  const rejected: VoterImportRejection[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based rows

    const identifier = sanitizeCell(pick(row, ["identifier", "nisn", "nim", "nik", "id"]));
    const voterName = sanitizeCell(pick(row, ["name", "nama", "nama lengkap"]));
    const group = sanitizeCell(pick(row, ["group", "group_name", "kelas", "prodi", "jurusan", "angkatan"]));
    const email = pick(row, ["email", "e-mail", "surel"]).toLowerCase();
    const phone = pick(row, ["phone", "hp", "no hp", "nomor hp", "whatsapp", "wa"]);

    if (!identifier && !voterName) return; // silently drop fully blank rows

    if (!identifier) {
      rejected.push({ rowNumber, raw: row, reason: "Kolom identitas (NISN/NIM/NIK) kosong." });
      return;
    }
    if (identifier.length > 32) {
      rejected.push({ rowNumber, raw: row, reason: "Identitas lebih dari 32 karakter." });
      return;
    }
    if (!voterName) {
      rejected.push({ rowNumber, raw: row, reason: "Kolom nama kosong." });
      return;
    }
    if (seen.has(identifier.toLowerCase())) {
      rejected.push({ rowNumber, raw: row, reason: `Identitas "${identifier}" duplikat.` });
      return;
    }
    if (email && !z.string().email().safeParse(email).success) {
      rejected.push({ rowNumber, raw: row, reason: `Email "${email}" tidak valid.` });
      return;
    }

    seen.add(identifier.toLowerCase());
    valid.push({
      rowNumber,
      identifier,
      name: voterName,
      group_name: group || undefined,
      email: email || undefined,
      phone: normalizePhone(phone) ?? undefined,
    });
  });

  return ok({ valid, rejected, totalRows: rows.length, quotaRemaining });
}

// ---------------------------------------------------------------------
// bulkInsertVoters — all-or-nothing commit
// ---------------------------------------------------------------------
const bulkInsertSchema = z.object({
  electionId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        identifier: z.string().min(1).max(32),
        name: z.string().min(1).max(120),
        group_name: z.string().max(60).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(20).optional(),
      }),
    )
    .min(1, "Tidak ada baris untuk disimpan."),
});

export async function bulkInsertVoters(
  input: z.input<typeof bulkInsertSchema>,
): Promise<ActionResult<{ inserted: number }>> {
  const parsed = bulkInsertSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }
  const { electionId, rows } = parsed.data;

  const access = await requireElectionAccess(electionId);
  if (!access.ok) return access;

  const supabase = await createClient();

  const { count } = await supabase
    .from("voters")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId);

  const currentCount = count ?? 0;
  const plan = access.data.tenant.plan;
  const quota = PLAN_LIMITS[plan].maxVoters;

  if (quota !== Infinity && currentCount + rows.length > quota) {
    return fail(
      `Paket ${plan} menampung ${quota} pemilih. Saat ini sudah ada ${currentCount} pemilih terdaftar dan file ini berisi ${rows.length} baris. Naik ke paket yang lebih besar, atau unggah maksimal ${Math.max(0, quota - currentCount)} baris.`,
      "PLAN_LIMIT",
    );
  }

  const { error } = await supabase.from("voters").insert(
    rows.map((r) => ({
      election_id: electionId,
      identifier: r.identifier,
      name: r.name,
      group_name: r.group_name ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      status: "UNINVITED" as const,
    })),
  );

  if (error) {
    if (error.code === "23505") {
      return fail("Ada identitas yang sudah terdaftar. Muat ulang halaman lalu unggah lagi.", "VALIDATION");
    }
    return fail("Gagal menyimpan DPT. Coba lagi.", "UNKNOWN");
  }

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId,
    action: "DPT_BULK_IMPORT",
    meta: { inserted: rows.length },
  });

  revalidatePath(adminVotersByElection(electionId));
  return ok({ inserted: rows.length });
}

// ---------------------------------------------------------------------
// generateVoterTokens — plaintext returned exactly once
// ---------------------------------------------------------------------
const generateSchema = z.object({
  electionId: z.string().uuid(),
  /** "all" regenerates for everyone; "pending" only for those without a token. */
  scope: z.enum(["all", "pending"]).default("pending"),
});

export async function generateVoterTokens(
  input: z.input<typeof generateSchema>,
): Promise<ActionResult<GeneratedToken[]>> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const { electionId, scope } = parsed.data;

  const access = await requireElectionAccess(electionId);
  if (!access.ok) return access;

  const supabase = await createClient();

  let query = supabase
    .from("voters")
    .select("id, identifier, name, group_name, token_hash, has_voted")
    .eq("election_id", electionId)
    .eq("has_voted", false) // never invalidate a token that was already used
    .neq("status", "BLOCKED");

  if (scope === "pending") query = query.is("token_hash", null);

  const { data: voters, error } = await query;

  if (error) return fail("Gagal membaca DPT.", "UNKNOWN");
  if (!voters || voters.length === 0) {
    return fail("Tidak ada pemilih yang perlu dibuatkan token.", "NOT_FOUND");
  }

  const tokens = generateTokens(voters.length);
  const admin = createAdminClient();

  const generated: GeneratedToken[] = [];

  // Hash and update one by one so a collision on token_hash surfaces cleanly.
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    const token = tokens[i];
    const tokenHash = await hashToken(token);

    const { error: updateError } = await admin
      .from("voters")
      .update({ token_hash: tokenHash, status: "UNINVITED" })
      .eq("id", voter.id);

    if (updateError) {
      return fail(
        `Gagal membuat token untuk ${voter.name}. Token yang sudah dibuat sebelum baris ini tetap berlaku — ulangi proses untuk sisanya.`,
        "UNKNOWN",
      );
    }

    generated.push({
      voterId: voter.id,
      identifier: voter.identifier,
      name: voter.name,
      group_name: voter.group_name,
      token,
    });
  }

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId,
    action: "TOKEN_GENERATE",
    meta: { scope, count: generated.length }, // never the tokens themselves
  });

  revalidatePath(adminVotersByElection(electionId));
  return ok(generated);
}

// ---------------------------------------------------------------------
// blockVoter / unblockVoter
// ---------------------------------------------------------------------
const voterActionSchema = z.object({
  electionId: z.string().uuid(),
  voterId: z.string().uuid(),
});

export async function setVoterBlocked(
  input: z.input<typeof voterActionSchema> & { blocked: boolean },
): Promise<ActionResult> {
  const parsed = voterActionSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("voters")
    .update({ status: input.blocked ? "BLOCKED" : "UNINVITED" })
    .eq("id", parsed.data.voterId)
    .eq("election_id", parsed.data.electionId)
    .eq("has_voted", false);

  if (error) return fail("Gagal mengubah status pemilih.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: input.blocked ? "VOTER_BLOCK" : "VOTER_UNBLOCK",
    meta: { voterId: parsed.data.voterId },
  });

  revalidatePath(adminVotersByElection(parsed.data.electionId));
  return ok(undefined);
}

// ---------------------------------------------------------------------
// deleteVoter — only allowed before they vote
// ---------------------------------------------------------------------
export async function deleteVoter(
  input: z.input<typeof voterActionSchema>,
): Promise<ActionResult> {
  const parsed = voterActionSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("voters")
    .delete({ count: "exact" })
    .eq("id", parsed.data.voterId)
    .eq("election_id", parsed.data.electionId)
    .eq("has_voted", false);

  if (error) return fail("Gagal menghapus pemilih.", "UNKNOWN");
  if (!count) {
    return fail(
      "Pemilih ini sudah memberikan suara, jadi datanya tidak bisa dihapus. Gunakan tombol blokir jika perlu.",
      "FORBIDDEN",
    );
  }

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "VOTER_DELETE",
    meta: { voterId: parsed.data.voterId },
  });

  revalidatePath(adminVotersByElection(parsed.data.electionId));
  return ok(undefined);
}

// ---------------------------------------------------------------------
// createVoter — single-row add, same sanitisation + quota rules as bulk import
// ---------------------------------------------------------------------
export async function createVoter(
  input: z.input<typeof voterFormSchema>,
): Promise<ActionResult<Voter>> {
  const parsed = voterFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }
  const { electionId, identifier, name, group_name, email, phone } = parsed.data;

  const access = await requireElectionAccess(electionId);
  if (!access.ok) return access;

  const supabase = await createClient();

  const { count } = await supabase
    .from("voters")
    .select("id", { count: "exact", head: true })
    .eq("election_id", electionId);

  const currentCount = count ?? 0;
  const plan = access.data.tenant.plan;
  const quota = PLAN_LIMITS[plan].maxVoters;

  if (quota !== Infinity && currentCount + 1 > quota) {
    return fail(
      `Paket ${plan} menampung ${quota} pemilih dan sudah terisi penuh. Naik ke paket yang lebih besar untuk menambah pemilih.`,
      "PLAN_LIMIT",
    );
  }

  const { data: existing } = await supabase
    .from("voters")
    .select("id")
    .eq("election_id", electionId)
    .ilike("identifier", identifier)
    .maybeSingle();

  if (existing) {
    return fail(`Identitas "${identifier}" sudah terdaftar di pemilihan ini.`, "VALIDATION", "identifier");
  }

  const { data: voter, error } = await supabase
    .from("voters")
    .insert({
      election_id: electionId,
      identifier,
      name,
      group_name: group_name || null,
      email: email || null,
      phone: phone || null,
      status: "UNINVITED",
    })
    .select()
    .single();

  if (error) return fail("Gagal menambahkan pemilih.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId,
    action: "VOTER_CREATE",
    meta: { identifier },
  });

  revalidatePath(adminVotersByElection(electionId));
  return ok(voter as unknown as Voter);
}

// ---------------------------------------------------------------------
// updateVoter — edit identity fields; blocked from touching has_voted/token
// ---------------------------------------------------------------------
export async function updateVoter(
  voterId: string,
  input: Omit<z.input<typeof voterFormSchema>, "electionId">,
): Promise<ActionResult<Voter>> {
  const supabase = await createClient();

  const { data: existingVoter } = await supabase
    .from("voters")
    .select("id, election_id, has_voted")
    .eq("id", voterId)
    .maybeSingle();

  if (!existingVoter) return fail("Pemilih tidak ditemukan.", "NOT_FOUND");

  const access = await requireElectionAccess(existingVoter.election_id);
  if (!access.ok) return access;

  if (existingVoter.has_voted) {
    return fail("Pemilih ini sudah memberikan suara, datanya tidak bisa diubah lagi.", "FORBIDDEN");
  }

  const parsed = voterFormSchema.omit({ electionId: true }).safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }
  const { identifier, name, group_name, email, phone } = parsed.data;

  const { data: duplicate } = await supabase
    .from("voters")
    .select("id")
    .eq("election_id", existingVoter.election_id)
    .ilike("identifier", identifier)
    .neq("id", voterId)
    .maybeSingle();

  if (duplicate) {
    return fail(`Identitas "${identifier}" sudah dipakai pemilih lain.`, "VALIDATION", "identifier");
  }

  const { data: voter, error } = await supabase
    .from("voters")
    .update({
      identifier,
      name,
      group_name: group_name || null,
      email: email || null,
      phone: phone || null,
    })
    .eq("id", voterId)
    .select()
    .single();

  if (error) return fail("Gagal memperbarui data pemilih.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: existingVoter.election_id,
    action: "VOTER_UPDATE",
    meta: { voterId },
  });

  revalidatePath(adminVotersByElection(existingVoter.election_id));
  return ok(voter as unknown as Voter);
}
