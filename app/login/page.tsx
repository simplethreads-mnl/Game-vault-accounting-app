import { Gamepad2 } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const configured = Boolean(process.env.OWNER_PASSWORD_HASH && (process.env.AUTH_SECRET?.length ?? 0) >= 32);
  // only allow same-site relative redirects
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-[#6250d6]/10 via-background to-[#2a78d6]/10 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl animate-fade-up">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#6250d6] to-[#2a78d6] text-white shadow-md">
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Game Vault</h1>
            <p className="text-xs text-muted-foreground">Sign in to your books</p>
          </div>
        </div>
        {configured ? (
          <LoginForm next={safeNext} />
        ) : (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">Login isn’t set up yet.</p>
            <p className="mt-1 text-muted-foreground">On the server, run <code className="rounded bg-card px-1">npm run auth:setup</code>, choose a password, then restart the app.</p>
          </div>
        )}
      </div>
    </div>
  );
}
