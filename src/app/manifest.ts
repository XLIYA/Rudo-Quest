import type { MetadataRoute } from "next";

/**
 * Purpose: Provide the web app manifest for PWA installability.
 * Inputs: None.
 * Output: Next.js metadata route manifest.
 * Side effects: None.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rudo Quest",
    short_name: "Rudo",
    description: "A compact collaborative weekly task planner.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FF5A1F",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
