import type { Metadata } from "next";

function resolveSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (raw) {
    try {
      const url = new URL(raw);

      if (url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // Fall back to the production origin for invalid values.
    }
  }

  return "https://forgexdevstudio.braxcode.com";
}

export const SITE_ORIGIN = resolveSiteOrigin();

export const SUPPORT_WHATSAPP = "https://wa.me/255618811359";
export const COMPANY_URL = "https://braxcode.com";
export const isPreviewDeployment = process.env.VERCEL_ENV === "preview";

export function publicMetadata(title: string, description: string, path: string): Metadata {
  return {
    title: { absolute: title }, description,
    alternates: { canonical: path },
    robots: { index: !isPreviewDeployment, follow: !isPreviewDeployment },
    openGraph: {
      type: "website", title, description, url: path, siteName: "FORGEX DevStudio",
      images: [{ url: "/brand/social.png", width: 1200, height: 630, alt: "FORGEX DevStudio — Developer Intelligence" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/brand/social.png"] },
  };
}
