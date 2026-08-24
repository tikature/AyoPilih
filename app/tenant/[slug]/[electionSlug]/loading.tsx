export default function Loading() {
  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-10 animate-pulse">
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
        </div>
        <div className="h-48 bg-muted rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  );
}