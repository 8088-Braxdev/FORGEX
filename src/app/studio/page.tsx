import type { Metadata } from "next";
import Workbench from "./Workbench";

export const metadata: Metadata = {
  title: "Studio",
  description: "Edit, preview, inspect and review your project in FORGEX.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/studio" },
};

export default function StudioPage() { return <Workbench />; }
