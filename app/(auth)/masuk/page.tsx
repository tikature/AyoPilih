import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-dvh bg-muted px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8">
        <Link href="/" className="font-display text-2xl font-extrabold">
          <span className="text-primary">Ayo</span>Pilih
        </Link>
        <div className="mt-8">
          <h1 className="font-display text-3xl font-bold">Masuk panitia</h1>
          <p className="mt-3 text-muted-foreground">Gunakan akun panitia untuk membuka dashboard tenant.</p>
        </div>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
