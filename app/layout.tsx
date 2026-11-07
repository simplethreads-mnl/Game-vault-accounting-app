import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export const metadata: Metadata = {
  title: { default: "Game Vault", template: "%s · Game Vault" },
  description: "Accounting, inventory and repair management for Nintendo Switch & iPhone resale and repair.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Sidebar />
          <div className="lg:pl-64">
            <Topbar />
            <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
