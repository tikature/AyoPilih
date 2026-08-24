"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireElectionAccess, logAudit } from "@/lib/auth";
import { PLAN_LIMITS } from "@/lib/plans";
import { formatDateTimeID, slugify } from "@/lib/utils";
import { voterInviteUrl } from "@/lib/routes";
import {
  ok,
  fail,
  type ActionResult,
  type AuditLog,
} from "@/types";

const sanitizeCell = (value: string): string => {
  const v = value.trim();
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
};

function escapeCsv(value: string): string {
  const sanitized = sanitizeCell(value);
  if (/[",\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

// ---------------------------------------------------------------------
// exportRekapSuara — CSV rekap suara per paslon
// ---------------------------------------------------------------------
const exportRekapSchema = z.object({
  electionId: z.string().uuid(),
});

export async function exportRekapSuara(
  input: z.input<typeof exportRekapSchema>,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const parsed = exportRekapSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("title, slug, tenant:tenants(name)")
    .eq("id", parsed.data.electionId)
    .single();

  if (!election) return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");

  const { data: liveCount } = await supabase.rpc("get_live_count", {
    p_election_id: parsed.data.electionId,
  });

  const rows: string[][] = [
    ["Pemilihan", election.title],
    ["Tanggal Ekspor", new Date().toISOString()],
    ["", ""],
    ["Nomor Urut", "Nama Paslon", "Wakil", "Jumlah Suara"],
  ];

  for (const item of liveCount ?? []) {
    rows.push([
      String(item.candidate_number),
      item.name,
      "", // running_mate would need another query; omitted for simplicity
      String(item.total),
    ]);
  }

  const filename = `rekap-suara-${slugify(election.title)}-${Date.now()}.csv`;

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "EXPORT_REKAP_CSV",
    meta: { rows: liveCount?.length ?? 0 },
  });

  return ok({ csv: rowsToCsv(rows), filename });
}

// ---------------------------------------------------------------------
// exportDaftarHadir — CSV daftar pemilih yang sudah memilih (tanpa pilihan)
// ---------------------------------------------------------------------
export async function exportDaftarHadir(
  input: z.input<typeof exportRekapSchema>,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const parsed = exportRekapSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("title, slug, tenant:tenants(name)")
    .eq("id", parsed.data.electionId)
    .single();

  if (!election) return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");

  const { data: voters } = await supabase
    .from("voters")
    .select("identifier, name, group_name, voted_at")
    .eq("election_id", parsed.data.electionId)
    .eq("has_voted", true)
    .order("voted_at", { ascending: true });

  const rows: string[][] = [
    ["Pemilihan", election.title],
    ["Tanggal Ekspor", new Date().toISOString()],
    ["", ""],
    ["Identitas (NISN/NIM/NIK)", "Nama", "Kelas/Prodi", "Waktu Memilih"],
  ];

  for (const v of voters ?? []) {
    rows.push([
      v.identifier,
      v.name,
      v.group_name ?? "",
      v.voted_at ? formatDateTimeID(v.voted_at) : "",
    ]);
  }

  const filename = `daftar-hadir-${slugify(election.title)}-${Date.now()}.csv`;

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "EXPORT_DAFTAR_HADIR_CSV",
    meta: { rows: voters?.length ?? 0 },
  });

  return ok({ csv: rowsToCsv(rows), filename });
}

// ---------------------------------------------------------------------
// exportAuditLog — CSV audit log
// ---------------------------------------------------------------------
const exportAuditSchema = z.object({
  electionId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  action: z.string().optional(),
});

export async function exportAuditLog(
  input: z.input<typeof exportAuditSchema>,
): Promise<ActionResult<{ csv: string; filename: string }>> {
  const parsed = exportAuditSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  let query = supabase
    .from("audit_logs")
    .select("action, actor_label, meta, created_at")
    .eq("election_id", parsed.data.electionId)
    .order("created_at", { ascending: false });

  if (parsed.data.from) query = query.gte("created_at", parsed.data.from);
  if (parsed.data.to) query = query.lte("created_at", parsed.data.to);
  if (parsed.data.action) query = query.eq("action", parsed.data.action);

  const { data: logs } = await query;

  const { data: election } = await supabase
    .from("elections")
    .select("title, tenant:tenants(name)")
    .eq("id", parsed.data.electionId)
    .single();

  const rows: string[][] = [
    ["Pemilihan", election?.title ?? ""],
    ["Tanggal Ekspor", new Date().toISOString()],
    ["Filter Aksi", parsed.data.action ?? "Semua"],
    ["Filter Dari", parsed.data.from ?? ""],
    ["Filter Sampai", parsed.data.to ?? ""],
    ["", ""],
    ["Waktu", "Aksi", "Pelaku", "Detail"],
  ];

  for (const log of logs ?? []) {
    rows.push([
      formatDateTimeID(log.created_at),
      log.action,
      log.actor_label ?? "sistem",
      JSON.stringify(log.meta),
    ]);
  }

  const filename = `audit-log-${slugify(election?.title ?? "pemilihan")}-${Date.now()}.csv`;

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "EXPORT_AUDIT_CSV",
    meta: { rows: logs?.length ?? 0 },
  });

  return ok({ csv: rowsToCsv(rows), filename });
}

// ---------------------------------------------------------------------
// generateBeritaAcaraPdf — PDF berita acara (paket Pro+)
// ---------------------------------------------------------------------
export async function generateBeritaAcaraPdf(
  input: z.input<typeof exportRekapSchema>,
): Promise<ActionResult<{ pdfBase64: string; filename: string }>> {
  const parsed = exportRekapSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  if (!PLAN_LIMITS[access.data.tenant.plan].pdfReport) {
    return fail(
      `Paket ${PLAN_LIMITS[access.data.tenant.plan].label} tidak mendukung ekspor PDF berita acara. Naik ke paket Pro untuk membuka fitur ini.`,
      "PLAN_LIMIT",
    );
  }

  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select(
      "title, subtitle, description, banner_url, tenant:tenants(name, logo_url, theme_color), start_time, end_time, show_candidates_before_login, show_public_result",
    )
    .eq("id", parsed.data.electionId)
    .single();

  if (!election) return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");

  const [{ data: liveCount }, { data: turnout }] = await Promise.all([
    supabase.rpc("get_live_count", { p_election_id: parsed.data.electionId }),
    supabase.rpc("get_turnout", { p_election_id: parsed.data.electionId }),
  ]);

  const { data: voters } = await supabase
    .from("voters")
    .select("id, has_voted")
    .eq("election_id", parsed.data.electionId);

  const totalVoters = voters?.length ?? 0;
  const voted = turnout?.[0]?.voted ?? 0;
  const percentage = totalVoters > 0 ? ((voted / totalVoters) * 100).toFixed(2) : "0.00";

  // Dynamically import pdfkit to avoid edge runtime issues
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<void>((resolve) => {
    doc.on("end", () => resolve());
  });

  // We'll build the PDF content here
  const tenantData = election.tenant as unknown as { name: string; logo_url: string | null; theme_color: string } | null;

  doc.fontSize(24).font("Helvetica-Bold").text("BERITA ACARA", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(16).font("Helvetica-Bold").text("PEMILIHAN", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(14).font("Helvetica").text(election.title, { align: "center" });
  if (election.subtitle) {
    doc.fontSize(12).text(election.subtitle, { align: "center" });
  }
  doc.moveDown(1);

  doc.fontSize(10).font("Helvetica-Bold").text(tenantData?.name ?? "AyoPilih", { align: "center" });
  doc.fontSize(9).font("Helvetica").text(`Tanggal: ${formatDateTimeID(election.start_time)} s/d ${formatDateTimeID(election.end_time)}`, { align: "center" });
  doc.moveDown(1);

  doc.fontSize(10).font("Helvetica").text(`Jumlah DPT: ${totalVoters}`);
  doc.text(`Jumlah Hadir (Memilih): ${voted}`);
  doc.text(`Partisipasi: ${percentage}%`);
  doc.moveDown(1);

  doc.fontSize(12).font("Helvetica-Bold").text("HASIL PEROLOHAN SUARA");
  doc.moveDown(0.5);

  const pageWidth = doc.page.width - 100;
  const colWidths = [60, pageWidth - 140, 80];
  const tableTop = doc.y;

  doc.font("Helvetica-Bold").fontSize(10);
  let x = doc.x;
  const headers = ["No. Urut", "Nama Paslon", "Suara"];
  headers.forEach((h, i) => {
    doc.text(h, x, tableTop, { width: colWidths[i], align: i === 0 ? "center" : i === 2 ? "right" : "left" });
    x += colWidths[i];
  });
  doc
    .moveTo(doc.x, tableTop + 20)
    .lineTo(doc.x + colWidths.reduce((a, b) => a + b, 0), tableTop + 20)
    .stroke();
  doc.y = tableTop + 25;

  doc.font("Helvetica").fontSize(10);
  for (const item of liveCount ?? []) {
    const rowY = doc.y;
    x = doc.x;
    doc.text(String(item.candidate_number), x, rowY, { width: colWidths[0], align: "center" });
    x += colWidths[0];
    doc.text(item.name, x, rowY, { width: colWidths[1] });
    x += colWidths[1];
    doc.text(String(item.total), x, rowY, { width: colWidths[2], align: "right" });
    x += colWidths[2];
    doc.moveDown(0.5);
  }

  doc.moveDown(2);
  doc.fontSize(10).font("Helvetica-Bold").text("TANDA TANGAN PANITIA");
  doc.moveDown(1.5);

  const ttdLines = [
    "Ketua Panitia,",
    "",
    "",
    "(____________________________)",
    "",
    "",
    "Sekretaris Panitia,",
    "",
    "",
    "(____________________________)",
  ];
  ttdLines.forEach((line) => {
    doc.fontSize(10).font("Helvetica").text(line);
    doc.moveDown(0.3);
  });

  doc.end();
  await finished;

  const pdfBuffer = Buffer.concat(chunks);
  const pdfBase64 = pdfBuffer.toString("base64");
  const filename = `berita-acara-${slugify(election.title)}-${Date.now()}.pdf`;

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "EXPORT_BERITA_ACARA_PDF",
    meta: { totalVoters, voted, percentage: Number(percentage) },
  });

  return ok({ pdfBase64, filename });
}

// ---------------------------------------------------------------------
// resendVoterInvitations — kirim ulang tautan masuk TANPA mengubah token
// Hanya kirim tautan masuk ke pemilih yang sudah punya token tapi belum memilih.
// Untuk pemilih tanpa token (UNINVITED), generate token baru.
// ---------------------------------------------------------------------
const sendTokensSchema = z.object({
  electionId: z.string().uuid(),
  channel: z.enum(["email", "whatsapp", "both"]),
});

export async function sendVoterTokens(
  input: z.input<typeof sendTokensSchema>,
): Promise<ActionResult<{ sent: number; failed: number; details: string[] }>> {
  const parsed = sendTokensSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const plan = access.data.tenant.plan;
  const channel = parsed.data.channel;

  if (channel === "email" || channel === "both") {
    if (!PLAN_LIMITS[plan].email) {
      return fail(
        `Paket ${PLAN_LIMITS[plan].label} tidak mendukung pengiriman token via email. Naik ke paket Pro.`,
        "PLAN_LIMIT",
      );
    }
    if (!process.env.RESEND_API_KEY) {
      return fail("Konfigurasi email (RESEND_API_KEY) belum disetel. Hubungi administrator.", "UNKNOWN");
    }
  }

  if (channel === "whatsapp" || channel === "both") {
    if (!PLAN_LIMITS[plan].whatsapp) {
      return fail(
        `Paket ${PLAN_LIMITS[plan].label} tidak mendukung pengiriman token via WhatsApp. Naik ke paket Pro.`,
        "PLAN_LIMIT",
      );
    }
    if (!process.env.FONNTE_TOKEN) {
      return fail("Konfigurasi WhatsApp (FONNTE_TOKEN) belum disetel. Hubungi administrator.", "UNKNOWN");
    }
  }

  const supabase = createAdminClient();

  const { data: election } = await supabase
    .from("elections")
    .select("title, slug, tenant:tenants(slug)")
    .eq("id", parsed.data.electionId)
    .single();

  if (!election) return fail("Pemilihan tidak ditemukan.", "NOT_FOUND");

  // Hanya ambil pemilih yang belum memilih (has_voted = false)
  const { data: voters } = await supabase
    .from("voters")
    .select("id, identifier, name, email, phone, token_hash, status")
    .eq("election_id", parsed.data.electionId)
    .eq("has_voted", false);

  if (!voters || voters.length === 0) {
    return fail("Tidak ada pemilih yang belum memilih.", "NOT_FOUND");
  }

  const tenantSlug = (election.tenant as unknown as { slug: string }).slug;
  const inviteUrl = voterInviteUrl(tenantSlug, election.slug);

  const results: string[] = [];
  let sent = 0;
  let failed = 0;

  // Aksi "Kirim ulang" HANYA mengirimkan undangan tautan masuk.
  // Jika pemilih belum memiliki token_hash, baru kita generate token baru untuk mereka.
  // Pemilih yang statusnya sudah SENT (atau punya token_hash) tidak digenerate ulang tokennya.
  const { generateTokens, hashToken } = await import("@/lib/crypto/token");

  // Pisahkan pemilih yang butuh token baru vs yang hanya butuh kirim ulang
  const votersNeedToken = voters.filter((v) => !v.token_hash);
  const votersWithToken = voters.filter((v) => v.token_hash);

  const newTokens = generateTokens(votersNeedToken.length);

  // 1. Generate & kirim untuk yang belum punya token sama sekali
  for (let i = 0; i < votersNeedToken.length; i++) {
    const voter = votersNeedToken[i];
    const token = newTokens[i];
    let success = false;

    try {
      if (channel === "email" || channel === "both") {
        if (voter.email) {
          await sendEmailViaResend(voter.email, voter.name, token, election.title, inviteUrl);
          success = true;
        }
      }
      if (channel === "whatsapp" || channel === "both") {
        if (voter.phone) {
          await sendWhatsAppViaFonnte(voter.phone, token, election.title, inviteUrl);
          success = true;
        }
      }
    } catch (err) {
      console.error("Send token failed:", err);
    }

    if (success) {
      const tokenHash = await hashToken(token);
      await supabase
        .from("voters")
        .update({ token_hash: tokenHash, status: "SENT" })
        .eq("id", voter.id);
      sent++;
      results.push(`✓ ${voter.name} (${voter.identifier}) - Token Baru`);
    } else {
      failed++;
      results.push(`✗ ${voter.name} (${voter.identifier}) — tidak ada kontak`);
    }
  }

  // 2. Kirim ulang tautan masuk saja (TANPA token) untuk yang sudah punya token
  for (const voter of votersWithToken) {
    let success = false;
    try {
      if (channel === "email" || channel === "both") {
        if (voter.email) {
          await sendEmailLinkOnly(voter.email, voter.name, election.title, inviteUrl);
          success = true;
        }
      }
      if (channel === "whatsapp" || channel === "both") {
        if (voter.phone) {
          await sendWhatsAppLinkOnly(voter.phone, election.title, inviteUrl);
          success = true;
        }
      }
    } catch (err) {
      console.error("Resend invitation failed:", err);
    }

    if (success) {
      await supabase
        .from("voters")
        .update({ status: "SENT" })
        .eq("id", voter.id);
      sent++;
      results.push(`✓ ${voter.name} (${voter.identifier}) - Undangan Dikirim Ulang`);
    } else {
      failed++;
      results.push(`✗ ${voter.name} (${voter.identifier}) — tidak ada kontak`);
    }
  }

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "INVITATION_RESEND",
    meta: { channel, sent, failed },
  });

  return ok({ sent, failed, details: results });
}

// ---------------------------------------------------------------------
// regenerateVoterToken — Aksi destruktif untuk generate token baru per pemilih
// ---------------------------------------------------------------------
const regenerateSchema = z.object({
  electionId: z.string().uuid(),
  voterId: z.string().uuid(),
});

export async function regenerateVoterToken(
  input: z.input<typeof regenerateSchema>,
): Promise<ActionResult<{ token: string }>> {
  const parsed = regenerateSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  const { data: voter } = await supabase
    .from("voters")
    .select("id, name, has_voted")
    .eq("id", parsed.data.voterId)
    .eq("election_id", parsed.data.electionId)
    .maybeSingle();

  if (!voter) return fail("Pemilih tidak ditemukan.", "NOT_FOUND");
  if (voter.has_voted) {
    return fail("Token tidak bisa digenerate baru karena pemilih sudah menyalurkan suaranya.", "FORBIDDEN");
  }

  const { generateTokens, hashToken } = await import("@/lib/crypto/token");
  const [token] = generateTokens(1);
  const tokenHash = await hashToken(token);

  const { error } = await supabase
    .from("voters")
    .update({ token_hash: tokenHash, status: "UNINVITED" })
    .eq("id", voter.id);

  if (error) return fail("Gagal membuat token baru.", "UNKNOWN");

  await logAudit({
    tenantId: access.data.tenant.id,
    electionId: parsed.data.electionId,
    action: "TOKEN_REGENERATED",
    meta: { voterId: voter.id },
  });

  return ok({ token });
}

async function sendEmailViaResend(to: string, name: string, token: string, electionTitle: string, inviteUrl: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY!;
  const FROM = process.env.EMAIL_FROM ?? "AyoPilih <noreply@ayopilih.id>";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #C81D1D;">Token Pemilihan: ${electionTitle}</h2>
      <p>Halo <strong>${name}</strong>,</p>
      <p>Anda terdaftar sebagai pemilih dalam pemilihan <strong>${electionTitle}</strong>.</p>
      <p>Token Anda: <strong style="font-size: 1.2em; letter-spacing: 0.1em; font-family: monospace;">${token}</strong></p>
      <p>Silakan masuk ke bilik suara melalui tautan berikut:</p>
      <p><a href="${inviteUrl}" style="background: #C81D1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Masuk Bilik Suara</a></p>
      <p style="color: #71706F; font-size: 0.9em;">Token ini bersifat rahasia. Jangan bagikan ke siapapun. Token hanya bisa dipakai sekali.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #DAD8D8;" />
      <p style="color: #71706F; font-size: 0.8em;">Email ini dikirim otomatis oleh sistem AyoPilih. Mohon tidak membalas email ini.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `Token Pemilihan: ${electionTitle}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
}

async function sendWhatsAppViaFonnte(phone: string, token: string, electionTitle: string, inviteUrl: string) {
  const FONNTE_TOKEN = process.env.FONNTE_TOKEN!;

  const message = `Token Pemilihan ${electionTitle}: ${token}\nSilakan coblos di: ${inviteUrl}\n\nToken ini rahasia, jangan dibagikan. Hanya bisa dipakai sekali.`;

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: FONNTE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: phone.replace(/\D/g, ""),
      message,
      countryCode: "62",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Fonnte error: ${JSON.stringify(err)}`);
  }
}

async function sendEmailLinkOnly(to: string, name: string, electionTitle: string, inviteUrl: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY!;
  const FROM = process.env.EMAIL_FROM ?? "AyoPilih <noreply@ayopilih.id>";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #C81D1D;">Undangan Pemilihan: ${electionTitle}</h2>
      <p>Halo <strong>${name}</strong>,</p>
      <p>Ini adalah pengingat untuk berpartisipasi dalam pemilihan <strong>${electionTitle}</strong>.</p>
      <p>Gunakan token yang sudah Anda terima sebelumnya. Tautan masuk bilik suara:</p>
      <p><a href="${inviteUrl}" style="background: #C81D1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Masuk Bilik Suara</a></p>
      <p style="color: #71706F; font-size: 0.9em;">Token yang sudah Anda terima tetap berlaku. Jangan bagikan ke siapapun.</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #DAD8D8;" />
      <p style="color: #71706F; font-size: 0.8em;">Email ini dikirim otomatis oleh sistem AyoPilih. Mohon tidak membalas email ini.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `Undangan Pemilihan: ${electionTitle}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
}

async function sendWhatsAppLinkOnly(phone: string, electionTitle: string, inviteUrl: string) {
  const FONNTE_TOKEN = process.env.FONNTE_TOKEN!;

  const message = `Undangan Pemilihan ${electionTitle}.\nSilakan masuk bilik suara di: ${inviteUrl}\n\nCatatan: Token yang Anda terima sebelumnya tetap berlaku. Jangan dibagikan.`;

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: FONNTE_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: phone.replace(/\D/g, ""),
      message,
      countryCode: "62",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Fonnte error: ${JSON.stringify(err)}`);
  }
}

// ---------------------------------------------------------------------
// getAuditLogs — untuk halaman audit log dengan filter
// ---------------------------------------------------------------------
const getAuditSchema = z.object({
  electionId: z.string().uuid(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  action: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function getAuditLogs(
  input: z.input<typeof getAuditSchema>,
): Promise<ActionResult<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>> {
  const parsed = getAuditSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .eq("election_id", parsed.data.electionId)
    .order("created_at", { ascending: false });

  if (parsed.data.action) query = query.eq("action", parsed.data.action);
  if (parsed.data.from) query = query.gte("created_at", parsed.data.from);
  if (parsed.data.to) query = query.lte("created_at", parsed.data.to);

  const page = parsed.data.page;
  const pageSize = parsed.data.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  const { data: logs, count, error } = await query;

  if (error) return fail("Gagal mengambil log audit.", "UNKNOWN");

  return ok({
    logs: (logs ?? []) as unknown as AuditLog[],
    total: count ?? 0,
    page,
    pageSize,
  });
}

// ---------------------------------------------------------------------
// searchVoters — cari pemilih di pemilihan berdasarkan identifier/nama
// ---------------------------------------------------------------------
const searchVotersSchema = z.object({
  electionId: z.string().uuid(),
  query: z.string().min(1, "Query pencarian minimal 1 karakter."),
  limit: z.number().int().positive().max(50).default(10),
});

export async function searchVoters(
  input: z.input<typeof searchVotersSchema>,
): Promise<ActionResult<Array<{ id: string; name: string; identifier: string; has_voted: boolean; status: string }>>> {
  const parsed = searchVotersSchema.safeParse(input);
  if (!parsed.success) return fail("Permintaan tidak valid.", "VALIDATION");

  const access = await requireElectionAccess(parsed.data.electionId);
  if (!access.ok) return access;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("voters")
    .select("id, name, identifier, has_voted, status")
    .eq("election_id", parsed.data.electionId)
    .or(`identifier.ilike.%${parsed.data.query.trim()}%,name.ilike.%${parsed.data.query.trim()}%`)
    .limit(parsed.data.limit);

  if (error) return fail("Gagal mencari pemilih.", "UNKNOWN");

  return ok((data ?? []) as unknown as Array<{ id: string; name: string; identifier: string; has_voted: boolean; status: string }>);
}