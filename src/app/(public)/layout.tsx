
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./public.module.css";
import SiteFooter from "@/components/SiteFooter";

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="FORGEX DevStudio home"
        >
          <span className={styles.brandIcon}>
            <img src="/brand/mark-96.png" alt="" width={46} height={46} />
          </span>

          <span className={styles.brandText}>
            <strong>FORGEX</strong>
            <small>DEVELOPER INTELLIGENCE</small>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/#features">Features</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help</Link>
          <Link href="/studio" className={styles.navPrimary}>
            Open FORGEX <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>

      <main className={styles.pageContent}>{children}</main>

      <SiteFooter />
    </div>
  );
}
