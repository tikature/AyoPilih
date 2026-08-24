"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName, updateEmail, updatePassword, revokeAllSessions } from "@/app/actions/settings";
import { toast } from "sonner";

interface AccountSettingsProps {
  userId: string;
  currentEmail: string;
  currentDisplayName: string;
}

export function AccountSettings({
  userId,
  currentEmail,
  currentDisplayName,
}: AccountSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Display name
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [displayNameError, setDisplayNameError] = useState("");

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handleDisplayNameSubmit() {
    setDisplayNameError("");
    startTransition(async () => {
      const result = await updateDisplayName({ userId, displayName });
      if (result.ok) {
        toast.success("Nama tampilan diperbarui.");
        router.refresh();
      } else {
        setDisplayNameError(result.error);
        toast.error(result.error);
      }
    });
  }

  async function handleEmailSubmit() {
    setEmailError("");
    if (!newEmail || !emailPassword) {
      setEmailError("Email baru dan kata sandi wajib diisi.");
      return;
    }
    startTransition(async () => {
      const result = await updateEmail({ userId, email: newEmail, password: emailPassword });
      if (result.ok) {
        toast.success("Email berhasil diubah. Silakan masuk ulang.");
        setTimeout(() => router.push("/masuk"), 1500);
      } else {
        setEmailError(result.error);
        toast.error(result.error);
      }
    });
  }

  async function handlePasswordSubmit() {
    setPasswordError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Semua kolom wajib diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    startTransition(async () => {
      const result = await updatePassword({ userId, currentPassword, newPassword });
      if (result.ok) {
        toast.success("Kata sandi berhasil diubah. Silakan masuk ulang.");
        setTimeout(() => router.push("/masuk"), 1500);
      } else {
        setPasswordError(result.error);
        toast.error(result.error);
      }
    });
  }

  async function handleRevokeSessions() {
    startTransition(async () => {
      const result = await revokeAllSessions({ userId });
      if (result.ok) {
        toast.success("Semua sesi dicabut. Silakan masuk ulang.");
        setTimeout(() => router.push("/masuk"), 1500);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 space-y-8">
      <h2 className="font-display text-xl font-bold">Akun Panitia</h2>

      {/* Display Name */}
      <div className="space-y-4">
        <h3 className="font-semibold">Nama Tampilan</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isPending}
            className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Nama lengkap"
          />
          <button
            onClick={handleDisplayNameSubmit}
            disabled={isPending || displayName.trim() === currentDisplayName}
            className="h-10 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            Simpan
          </button>
        </div>
        {displayNameError && <p className="text-sm text-destructive">{displayNameError}</p>}
      </div>

      <hr className="border-border" />

      {/* Email */}
      <div className="space-y-4">
        <h3 className="font-semibold">Email</h3>
        <p className="text-sm text-muted-foreground">Email saat ini: <strong>{currentEmail}</strong></p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isPending}
            className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Email baru"
          />
          <input
            type="password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            disabled={isPending}
            className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Kata sandi saat ini (untuk verifikasi)"
          />
          <button
            onClick={handleEmailSubmit}
            disabled={isPending}
            className="h-10 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            Ubah Email
          </button>
        </div>
        {emailError && <p className="text-sm text-destructive">{emailError}</p>}
      </div>

      <hr className="border-border" />

      {/* Password */}
      <div className="space-y-4">
        <h3 className="font-semibold">Kata Sandi</h3>
        <div className="space-y-2">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isPending}
            className="w-full h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Kata sandi saat ini"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isPending}
            className="w-full h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Kata sandi baru (min. 8 karakter)"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
            className="w-full h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            placeholder="Konfirmasi kata sandi baru"
          />
          <button
            onClick={handlePasswordSubmit}
            disabled={isPending}
            className="h-10 rounded-full bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            Ubah Kata Sandi
          </button>
        </div>
        {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
      </div>

      <hr className="border-border" />

      {/* Revoke Sessions */}
      <div className="space-y-2">
        <h3 className="font-semibold">Sesi Aktif</h3>
        <p className="text-sm text-muted-foreground">
          Keluar dari semua perangkat. Anda akan diminta masuk ulang.
        </p>
        <button
          onClick={handleRevokeSessions}
          disabled={isPending}
          className="h-10 rounded-full border border-destructive px-5 font-semibold text-destructive hover:bg-destructive hover:text-primary-foreground disabled:opacity-60"
        >
          Keluar dari Semua Perangkat
        </button>
      </div>
    </section>
  );
}