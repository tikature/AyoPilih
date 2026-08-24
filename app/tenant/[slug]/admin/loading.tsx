export default function Loading() {
  return (
    <main className="min-h-dvh bg-muted px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-2xl" />
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="h-6 bg-muted rounded w-1/4 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}