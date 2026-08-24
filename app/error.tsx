"use client";

export default function Error({
  reset,
}: {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh bg-muted px-4 py-20 flex items-center justify-center">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <p className="font-display text-6xl font-bold text-destructive">500</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Terjadi Kesalahan Server</h1>
        <p className="mt-3 text-muted-foreground">
          Maaf, terjadi kesalahan yang tidak terduga. Tim kami telah diberitahu.
        </p>
        <button
          onClick={reset}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Coba Lagi
        </button>
      </div>
    </main>
  );
}