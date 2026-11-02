
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./public.module.css";
import SupportLinks from "@/components/SupportLinks";
import { COMPANY_URL } from "@/lib/siteInfo";

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

      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} <a href={COMPANY_URL} aria-label="BraxCode Digitals Foundation website" target="_blank" rel="noopener noreferrer">BraxCode Digitals Foundation</a>.
          <span className={styles.footerSub}> FORGEX DevStudio</span>
        </span>

        <nav aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
        <SupportLinks />
      </footer>
    </div>
  );
}
