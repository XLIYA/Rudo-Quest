import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Fjord_One } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const fjordOne = Fjord_One({
  variable: "--font-fjord-one",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fjordOne.variable} h-full antialiased`}
    >
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
