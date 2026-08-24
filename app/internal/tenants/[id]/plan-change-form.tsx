"use client";

import { useActionState } from "react";
import { updateTenantPlanForm } from "@/app/actions/super-admin";
import type { PlanType } from "@/types";

interface PlanChangeFormProps {
  tenantId: string;
  currentPlan: PlanType;
}

export function PlanChangeForm({ tenantId, currentPlan }: PlanChangeFormProps) {
  const [error, formAction, isPending] = useActionState(
    async (prevState: string | undefined, formData: FormData) => {
      await updateTenantPlanForm(tenantId, formData);
      return undefined;
    },
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-sm font-semibold">Paket Baru</label>
          <select
            name="plan"
            defaultValue={currentPlan}
            disabled={isPending}
            className="mt-2 w-full h-10 rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            <option value="STARTER">Starter (Gratis)</option>
            <option value="PRO">Pro (Rp 299.000 / pemilihan)</option>
            <option value="ENTERPRISE">Enterprise (Mulai Rp 2.500.000 / tahun)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold">Catatan (WAJIB: nomor invoice / bukti transfer)</label>
        <textarea
          name="note"
          required
          minLength={5}
          disabled={isPending}
          className="mt-2 min-h-24 w-full rounded-2xl border border-border bg-background p-4 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          placeholder="Contoh: Invoice #INV-2024-001, transfer BCA 1234567890 a.n. PT AyoPilih"
        />
      </div>
      <div>
        <label className="text-sm font-semibold">Berlaku Sampai</label>
        <input
          name="validUntil"
          type="date"
          required
          disabled={isPending}
          className="mt-2 w-full max-w-xs h-10 rounded-full border border-border bg-background px-4 outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Perubahan Paket"}
      </button>
    </form>
  );
}