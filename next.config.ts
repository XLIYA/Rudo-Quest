import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    // Keep the large authenticated E2E surface within the dev server's memory
    // envelope while retaining full typechecking and source maps.
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  additionalPrecacheEntries: [{ url: "/offline", revision: "rudo-offline-v1" }],
});

const appConfig = withSerwist(nextConfig);
const enableSentryBuild = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN,
);

export default enableSentryBuild
  ? withSentryConfig(appConfig, {
      silent: !process.env.CI,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
    })
  : appConfig;
