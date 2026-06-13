import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DanceDispatch",
    short_name: "DanceDispatch",
    description: "Find your next dance party",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c1a",
    theme_color: "#22d3ee",
    orientation: "portrait",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        form_factor: "narrow",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        form_factor: "wide",
      },
    ],
    categories: ["entertainment", "lifestyle"],
    prefer_related_applications: false,
  };
}
