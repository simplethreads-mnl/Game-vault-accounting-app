"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Try again</button>
    </div>
  );
}
