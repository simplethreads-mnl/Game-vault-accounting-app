import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata: Metadata = {
  title: { default: "Game Vault", template: "%s · Game Vault" },
  description: "Accounting, inventory and repair management for Nintendo Switch & iPhone resale and repair.",
  robots: { index: false, follow: false },
  applicationName: "Game Vault",
  appleWebApp: { capable: true, title: "Game Vault", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // draw under the notch; padding below keeps content clear
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
