#!/usr/bin/env tsx
/**
 * Bootstrap Super Admin — HANYA DIJALANKAN SEKALI SAAT SETUP AWAL.
 *
 * Cara pakai:
 *   npx tsx scripts/bootstrap-superadmin.ts
 *
   Atau dengan force (untuk menambah super admin berikutnya):
 *   npx tsx scripts/bootstrap-superadmin.ts --force
 *
 * Prasyarat:
 * - Email sudah terdaftar di Supabase Auth (lewat /daftar)
 * - SUPER_ADMIN_EMAILS di .env.local sudah diisi
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib di .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rawEmails = process.env.SUPER_ADMIN_EMAILS ?? "";
const allowedEmails = rawEmails
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (allowedEmails.length === 0) {
  console.error("❌ SUPER_ADMIN_EMAILS kosong di .env.local");
  process.exit(1);
}

const isForce = process.argv.includes("--force");
const isProd = process.env.NODE_ENV === "production";

async function main() {
  console.log("🔧 Bootstrap Super Admin");
  console.log("========================\n");

  // Cek apakah sudah ada platform_admins (kecuali --force)
  const { count: existingCount, error: checkError } = await supabase
    .from("platform_admins")
    .select("id", { count: "exact", head: true });

  if (checkError) {
    console.error("❌ Gagal cek platform_admins:", checkError.message);
    process.exit(1);
  }

  if ((existingCount ?? 0) > 0 && !isForce) {
    console.log("⚠️  platform_admins sudah terisi. Gunakan --force untuk menambah.");
    console.log("   Di produksi, super admin berikutnya ditambahkan via dashboard /internal.");
    process.exit(0);
  }

  if (isProd && !isForce) {
    console.error("❌ Di produksi, gunakan --force untuk menjalankan bootstrap.");
    process.exit(1);
  }

  let added = 0;
  for (const email of allowedEmails) {
    // Cari user di auth.users (list all, filter manual)
    const { data: userList, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error(`❌ Gagal cari user ${email}:`, userError.message);
      continue;
    }

    const user = userList.users.find((u) => u.email?.toLowerCase() === email);

    if (!user) {
      console.log(`⏭️  ${email}: belum terdaftar di Supabase Auth.`);
      console.log(`   Daftar dulu lewat /daftar dengan email ini, lalu jalankan ulang skrip ini.`);
      continue;
    }

    // Cek apakah sudah ada di platform_admins
    const { data: existing } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      console.log(`✅ ${email}: sudah terdaftar sebagai platform admin.`);
      continue;
    }

    // Masukkan ke platform_admins
    const { error: insertError } = await supabase.from("platform_admins").insert({
      user_id: user.id,
      email: user.email!,
      is_active: true,
      created_by: user.id, // self-created for first admin
    });

    if (insertError) {
      console.error(`❌ Gagal tambah ${email}:`, insertError.message);
      continue;
    }

    console.log(`✅ ${email}: berhasil ditambahkan sebagai platform admin.`);
    added++;
  }

  if (added === 0 && allowedEmails.length > 0) {
    console.log("\n⚠️  Tidak ada super admin baru yang ditambahkan.");
    console.log("   Pastikan email di SUPER_ADMIN_EMAILS sudah register lewat /daftar.");
  } else {
    console.log(`\n🎉 Selesai! ${added} super admin ditambahkan.`);
  }
}

main().catch((err) => {
  console.error("❌ Error tak terduga:", err);
  process.exit(1);
});