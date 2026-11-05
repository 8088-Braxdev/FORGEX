import type { MetadataRoute } from "next";
import { isPreviewDeployment, SITE_ORIGIN } from "@/lib/siteInfo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", ...(isPreviewDeployment ? { disallow: "/" } : { allow: "/", disallow: ["/studio", "/api/", "/__qa/"] }) },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
