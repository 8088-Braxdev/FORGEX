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
        src: "/forgex-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}