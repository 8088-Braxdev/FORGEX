import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import { publicMetadata, SITE_ORIGIN } from "@/lib/siteInfo";
import "./style.css";
import "./mini-ide.css";
import "./responsive-polish.css";
import { AppConfirmProvider } from "@/components/AppConfirmProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import OfflineBanner from "@/components/OfflineBanner";


const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-forgex-sans",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-forgex-mono",
});

export const metadata: Metadata = {
  ...publicMetadata("FORGEX DevStudio — Developer Intelligence", "Inspect real source code, investigate risks, and build with confidence. By BraxCode Digitals Foundation.", "/"),
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: "FORGEX DevStudio — Developer Intelligence", template: "%s | FORGEX DevStudio" },
  applicationName: "FORGEX DevStudio",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/brand/mark-96.png", type: "image/png", sizes: "96x96" }],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${mono.variable}`}>
      <body>
        <AppConfirmProvider>{children}</AppConfirmProvider>
        <ServiceWorkerRegistration />
        <OfflineBanner />
      </body>
    </html>
  );
}