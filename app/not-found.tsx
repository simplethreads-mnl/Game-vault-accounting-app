import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <p className="text-5xl font-semibold">404</p>
      <p className="mt-2 text-muted-foreground">That page or record doesn’t exist.</p>
      <Link href="/" className="mt-4 text-primary">Back to dashboard</Link>
    </div>
  );
}
