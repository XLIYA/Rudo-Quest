import type { Metadata } from "next";
import { Bitcount_Ink, Manrope, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

const bitcountInk = Bitcount_Ink({
  variable: "--font-bitcount-ink",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${robotoMono.variable} ${bitcountInk.variable} h-full antialiased`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
