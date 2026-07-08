import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const agentationConnectSources = (() => {
  if (process.env.NODE_ENV === "production") {
    return [];
  }

  const endpoint =
    process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT ?? "http://localhost:4747";

  try {
    const url = new URL(endpoint);
    const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return [`${url.protocol}//${url.host}`, `${websocketProtocol}//${url.host}`];
  } catch {
    return ["http://localhost:4747", "ws://localhost:4747"];
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://avatars.githubusercontent.com",
              "font-src 'self'",
              [
                "connect-src",
                "'self'",
                ...agentationConnectSources,
                "https://*.supabase.co",
                "https://*.ingest.sentry.io",
              ].join(" "),
              "manifest-src 'self'",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
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

export default withSentryConfig(
  withSerwist(nextConfig),
  process.env.SENTRY_AUTH_TOKEN
    ? {
      silent: !process.env.CI,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
    }
    : {
      silent: !process.env.CI,
      widenClientFileUpload: true,
    },
);
