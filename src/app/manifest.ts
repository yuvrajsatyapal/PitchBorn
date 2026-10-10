import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PitchBorn — Football Career Simulator",
    short_name: "PitchBorn",
    description: "Live an entire footballer's career in your browser. Free, offline-capable, no account.",
    start_url: "/play/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fff5e6",
    theme_color: "#fff5e6",
    categories: ["games", "sports"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
