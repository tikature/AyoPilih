"use client";

import { useActionState } from "react";
import { inviteMember, updateMemberRole, removeMember } from "@/app/actions/members";

import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/types";

interface MembersManagerProps {
  tenantId: string;
  currentUserRole: "OWNER" | "ADMIN" | "VIEWER";
  plan: PlanType;
  members: Array<{
    id: string;
    userId: string;
    email: string;
    role: "OWNER" | "ADMIN" | "VIEWER";
    created_at: string;
  }>;
  currentUserId: string;
}

export function MembersManager({
  tenantId,
  currentUserRole,
  plan,
  members,
  currentUserId,
}: MembersManagerProps) {
  const [error, inviteAction, isInviting] = useActionState(
    async (prevError: string | undefined, formData: FormData) => {
      const result = await inviteMember({
        tenantId,
        email: formData.get("email") as string,
        role: formData.get("role") as "ADMIN" | "VIEWER",
      });
      if (!result.ok) {
        return result.error;
      }
      return undefined;
    },
    undefined
  );

  const [, updateAction] = useActionState(
    async (prevError: string | undefined, formData: FormData) => {
      const result = await updateMemberRole({
        tenantId,
        memberId: formData.get("memberId") as string,
        role: formData.get("role") as "ADMIN" | "VIEWER",
      });
      if (!result.ok) {
        return result.error;
      }
      return undefined;
    },
    undefined
  );

  const [, removeAction, isRemoving] = useActionState(
    async (prevError: string | undefined, formData: FormData) => {
      const result = await removeMember({ tenantId, memberId: formData.get("memberId") as string });
      if (!result.ok) {
        return result.error;
      }
      return undefined;
    },
    undefined
  );

  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <section className="rounded-3xl border border-border bg-card p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Anggota Panitia</h2>
        {canManage && (
          <form action={inviteAction} className="flex items-center gap-2">
            <input
              name="email"
              type="email"
              placeholder="Email calon anggota"
              required
              className="h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              name="role"
              defaultValue="VIEWER"
              className="h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="VIEWER">Pemantau</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              type="submit"
              disabled={isInviting}
              className="h-10 rounded-full bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {isInviting ? "Mengundang..." : "Undang"}
            </button>
          </form>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="p-4 text-left font-semibold">Email</th>
              <th className="p-4 text-left font-semibold">Peran</th>
              <th className="p-4 text-left font-semibold">Bergabung</th>
              <th className="p-4 text-left font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-4">
                  <p className="font-medium">{m.email}</p>
                  {m.userId === currentUserId && (
                    <span className="text-xs text-muted-foreground">(Anda)</span>
                  )}
                </td>
                <td className="p-4">
                  {m.role === "OWNER" ? (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {m.role}
                    </span>
                  ) : (
                    <form action={updateAction} className="inline">
                      <input type="hidden" name="memberId" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        onChange={(e) => e.currentTarget.form?.requestSubmit?.()}
                        disabled={!canManage || m.userId === currentUserId}
                        className="h-8 rounded-full border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="VIEWER">Pemantau</option>
                      </select>
                    </form>
                  )}
                </td>
                <td className="p-4 text-muted-foreground text-xs">
                  {new Date(m.created_at).toLocaleDateString("id-ID")}
                </td>
                <td className="p-4">
                  {m.role !== "OWNER" && m.userId !== currentUserId && canManage && (
                    <form
                      action={removeAction}
                      onSubmit={(e) => { if (!confirm("Hapus anggota ini?")) e.preventDefault(); }}
                    >
                      <input type="hidden" name="memberId" value={m.id} />
                      <button
                        type="submit"
                        disabled={isRemoving}
                        className="h-8 w-8 rounded-full border border-destructive text-destructive hover:bg-destructive hover:text-primary-foreground disabled:opacity-60"
                        title="Hapus anggota"
                      >
                        🗑️
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Belum ada anggota panitia.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Batas anggota: <strong>{PLAN_LIMITS[plan].maxMembers}</strong> sesuai paket tenant.
      </p>
    </section>
  );
}