import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const manrope = localFont({
  src: "../assets/fonts/manrope-latin.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  style: "normal",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const robotoMono = localFont({
  src: "../assets/fonts/roboto-mono-latin.woff2",
  variable: "--font-roboto-mono",
  weight: "100 700",
  style: "normal",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  applicationName: "Rudo Quest",
  title: {
    default: "Rudo Quest",
    template: "%s | Rudo Quest",
  },
  description: "A compact collaborative weekly task-management PWA.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Rudo Quest",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Purpose: Define the global document, local font variables, and application providers.
 * Inputs: Current App Router content.
 * Output: Root HTML document tree.
 * Side effects: Reads the request nonce and mounts theme, query, PWA, and Vercel telemetry providers.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const enableVercelTelemetry = process.env.VERCEL === "1";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${robotoMono.variable} h-full antialiased`}
    >
      <body>
        <Providers nonce={nonce}>{children}</Providers>
        {enableVercelTelemetry ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
