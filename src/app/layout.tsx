
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import "./style.css";
import "./mini-ide.css";
import { AppConfirmProvider } from "@/components/AppConfirmProvider";


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
  metadataBase: new URL("https://forgex-gamma.vercel.app"),
  title: {
    default: "FORGEX — Developer Intelligence",
    template: "%s | FORGEX",
  },
  description:
    "Inspect real source code, investigate risks, and build with confidence. By BraxCode Digitals Foundation.",
  applicationName: "FORGEX",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "FORGEX",
    title: "FORGEX — Developer Intelligence",
    description:
      "Inspect real source code, investigate risks, and build with confidence.",
    url: "https://forgex-gamma.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "FORGEX — Developer Intelligence",
    description:
      "Inspect real source code, investigate risks, and build with confidence.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${mono.variable}`}>
      <body>
        <AppConfirmProvider>{children}</AppConfirmProvider>
      </body>
    </html>
  );
}
