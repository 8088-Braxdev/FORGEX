import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/welcome", "/privacy", "/terms"],
      disallow: [
        "/studio",
        "/api/",
        "/_next/",
      ],
    },
    sitemap: "https://forgex-gamma.vercel.app/sitemap.xml",
  };
}