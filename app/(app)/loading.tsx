export default function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
