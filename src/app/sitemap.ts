import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/siteInfo";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/help", "/privacy", "/terms"].map(path => ({ url: `${SITE_ORIGIN}${path}` }));
}
