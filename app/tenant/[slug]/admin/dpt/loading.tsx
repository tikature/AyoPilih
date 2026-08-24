export default function Loading() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </div>
    </main>
  );
}
