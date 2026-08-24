import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8">
        <Link href="/" className="font-display text-2xl font-extrabold">
          <span className="text-primary">Ayo</span>Pilih
        </Link>
        <div className="mt-8">
          <h1 className="font-display text-3xl font-bold">Atur ulang kata sandi</h1>
          <p className="mt-3 text-muted-foreground">Masukkan email panitia. Kami akan mengirim tautan pemulihan.</p>
        </div>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
