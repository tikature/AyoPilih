"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "@/types";
import { logAudit } from "@/lib/auth";
import { tenantUrl } from "@/lib/utils";

const RESERVED_SLUGS = [
  "www", "app", "admin", "api", "auth", "cdn", "mail", "support",
  "status", "docs", "blog", "staging", "preview", "login", "register",
  "dashboard", "tenant", "election", "vote", "result", "panel",
];

const signInSchema = z.object({
  email: z.string().email("Alamat email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Alamat email tidak valid."),
});

const signUpSchema = z.object({
  email: z.string().email("Alamat email tidak valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
  fullName: z.string().min(2, "Nama lengkap wajib diisi."),
  institution: z.string().optional(),
  tenantName: z.string().min(2, "Nama organisasi wajib diisi."),
  tenantSlug: z
    .string()
    .min(2, "Subdomain minimal 2 karakter.")
    .max(32, "Subdomain maksimal 32 karakter.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Hanya huruf kecil, angka, dan tanda hubung di tengah.",
    )
    .transform((v) => v.toLowerCase()),
});

export async function checkSlugAvailability(slug: string): Promise<ActionResult<{ available: boolean; reason?: string }>> {
  const cleanSlug = slug.trim().toLowerCase();
  if (cleanSlug.length < 2) {
    return ok({ available: false, reason: "Subdomain minimal 2 karakter." });
  }

  if (RESERVED_SLUGS.includes(cleanSlug)) {
    return ok({ available: false, reason: `"${cleanSlug}" tidak bisa dipakai. Pilih subdomain lain.` });
  }

  const supabase = createAdminClient();

  const { data: reserved } = await supabase
    .from("reserved_slugs")
    .select("slug")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (reserved) {
    return ok({ available: false, reason: `"${cleanSlug}" tidak bisa dipakai. Pilih subdomain lain.` });
  }

  const { data: existing } = await supabase
    .from("tenants")
    .select("slug")
    .eq("slug", cleanSlug)
    .maybeSingle();

  return ok({ available: !existing });
}

export async function signInAction(input: z.input<typeof signInSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.", "VALIDATION");
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !signInData.user) {
    return fail("Email atau kata sandi tidak cocok.", "UNAUTHORIZED");
  }

  const userId = signInData.user.id;
  const adminClient = createAdminClient();

  const { data: platformAdmin } = await adminClient
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (platformAdmin) {
    return ok({ redirectTo: "/internal" });
  }

  const { data: tenants } = await adminClient
    .from("tenants")
    .select("slug")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  const ownedSlug = tenants?.[0]?.slug ?? null;

  const { data: memberships } = await adminClient
    .from("tenant_members")
    .select("tenant:tenants(slug, is_active)")
    .eq("user_id", userId)
    .limit(1);

  const memberSlug =
    (memberships?.[0]?.tenant as unknown as { slug?: string; is_active?: boolean } | null)?.slug ?? null;

  const tenantSlug = ownedSlug ?? memberSlug;

  if (tenantSlug) {
    return ok({ redirectTo: tenantUrl(tenantSlug, "/admin") });
  }

  return ok({ redirectTo: "/daftar?reason=no-tenant" });
}

export async function forgotPasswordAction(input: z.input<typeof forgotPasswordSchema>): Promise<ActionResult<void>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Email tidak valid.", "VALIDATION");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/masuk`,
  });

  if (error) {
    return fail("Gagal mengirim tautan pemulihan. Coba lagi sebentar.", "UNKNOWN");
  }

  return ok(undefined);
}

export async function signUpWithTenant(input: z.input<typeof signUpSchema>): Promise<ActionResult<{ tenantSlug: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Data tidak valid.",
      "VALIDATION",
      parsed.error.issues[0]?.path.join("."),
    );
  }

  const { email, password, fullName, institution, tenantName, tenantSlug } = parsed.data;

  const slugCheck = await checkSlugAvailability(tenantSlug);
  if (!slugCheck.ok) return slugCheck;
  if (!slugCheck.data.available) {
    return fail(
      slugCheck.data.reason ?? "Subdomain tidak tersedia.",
      "VALIDATION",
      "tenantSlug",
    );
  }

  const supabase = createAdminClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, institution },
  });

  if (authError) {
    const message = authError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return fail("Email sudah terdaftar. Silakan masuk atau gunakan email lain.", "VALIDATION", "email");
    }
    return fail(`Gagal membuat akun: ${authError.message}`, "UNKNOWN");
  }

  if (!authData.user) {
    return fail("Gagal membuat akun. Coba lagi sebentar.", "UNKNOWN");
  }

  const { error: tenantError } = await supabase
    .from("tenants")
    .insert({
      owner_id: authData.user.id,
      name: tenantName,
      slug: tenantSlug,
      institution: institution || null,
      theme_color: "#C81D1D",
      plan: "STARTER",
      is_active: true,
    })
    .select()
    .single();

  if (tenantError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return fail("Gagal membuat ruang organisasi. Coba lagi sebentar.", "UNKNOWN");
  }

  await logAudit({
    tenantId: null,
    action: "TENANT_CREATED",
    meta: { slug: tenantSlug, email },
  });

  return ok({ tenantSlug });
}

export async function signOutAction(): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return fail("Gagal keluar. Coba lagi.", "UNKNOWN");
  }
  return ok(undefined);
}

export async function signOutAndRedirectAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}

const createTenantByAdminSchema = z.object({
  name: z.string().min(2, "Nama organisasi minimal 2 karakter."),
  slug: z
    .string()
    .min(2, "Subdomain minimal 2 karakter.")
    .max(32, "Subdomain maksimal 32 karakter.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Hanya huruf kecil, angka, dan tanda hubung di tengah.",
    )
    .transform((v) => v.toLowerCase()),
  ownerEmail: z.string().email("Email panitia tidak valid."),
  plan: z.enum(["STARTER", "PRO", "ENTERPRISE"]),
});

export async function createTenantByAdmin(
  input: z.input<typeof createTenantByAdminSchema>,
): Promise<ActionResult<{ tenantSlug: string; ownerEmail: string }>> {
  const parsed = createTenantByAdminSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Data tidak valid.",
      "VALIDATION",
      parsed.error.issues[0]?.path.join("."),
    );
  }

  const { name, slug, ownerEmail, plan } = parsed.data;

  const slugCheck = await checkSlugAvailability(slug);
  if (!slugCheck.ok) return slugCheck;
  if (!slugCheck.data.available) {
    return fail(
      slugCheck.data.reason ?? "Subdomain tidak tersedia.",
      "VALIDATION",
      "slug",
    );
  }

  const adminClient = createAdminClient();

  let userId: string;

  const { data: createdAuthData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: ownerEmail,
      email_confirm: true,
      user_metadata: { full_name: "Panitia " + name },
    });

  if (authError) {
    const message = authError.message.toLowerCase();
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists")
    ) {
      const { data: listData } = await adminClient.auth.admin.listUsers();
      const existing = listData?.users?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u: any) => u.email === ownerEmail,
      );
      if (existing) {
        userId = existing.id;
      } else {
        return fail(
          "Email sudah terdaftar tapi tidak dapat ditemukan. Hubungi dukungan.",
          "UNKNOWN",
        );
      }
    } else {
      return fail(`Gagal membuat akun panitia: ${authError.message}`, "UNKNOWN");
    }
  } else if (!createdAuthData.user) {
    return fail("Gagal membuat akun panitia.", "UNKNOWN");
  } else {
    userId = createdAuthData.user.id;
  }

  const { data: tenantRow, error: tenantError } = await adminClient
    .from("tenants")
    .insert({
      owner_id: userId,
      name,
      slug,
      plan,
      theme_color: "#C81D1D",
      is_active: true,
    })
    .select()
    .single();

  if (tenantError || !tenantRow) {
    return fail("Gagal membuat tenant. Coba lagi sebentar.", "UNKNOWN");
  }

  const { error: memberError } = await adminClient.from("tenant_members").insert({
    tenant_id: tenantRow.id,
    user_id: userId,
    role: "OWNER",
  });

  if (memberError) {
    return fail("Gagal menambahkan panitia sebagai owner.", "UNKNOWN");
  }

  await logAudit({
    tenantId: null,
    action: "TENANT_CREATED",
    meta: { slug, email: ownerEmail, plan, createdBy: "super_admin" },
  });

  return ok({ tenantSlug: slug, ownerEmail });
}
