
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FORGEX DevStudio",
    short_name: "FORGEX",
    description:
      "Inspect source code, investigate risks, and build with confidence.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d141a",
    theme_color: "#101920",
    lang: "en-US",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
