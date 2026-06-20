import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DanceDispatch",
    short_name: "DanceDispatch",
    description: "Are you ready to dance?",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c1a",
    theme_color: "#22d3ee",
    orientation: "portrait",
     categories: ["entertainment", "social", "music","dance","clubbing","nightlife","new york", "new york city", "nyc", "house music"],
    lang: "en",
    dir: "ltr",
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
      {
        src: "/icons/icon_1.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
