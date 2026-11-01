
import Link from "next/link";
import type { ReactNode } from "react";
import { Code2, ArrowUpRight } from "lucide-react";
import styles from "./public.module.css";

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link
          href="/welcome"
          className={styles.brand}
          aria-label="FORGEX DevStudio home"
        >
          <span className={styles.brandIcon}>
            <Code2 size={22} />
          </span>

          <span className={styles.brandText}>
            <strong>FORGEX</strong>
            <small>DEVELOPER INTELLIGENCE</small>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/welcome#features">Features</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/" className={styles.navPrimary}>
            Open IDE <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>

      <main className={styles.pageContent}>{children}</main>

      <footer className={styles.footer}>
        <span>
          © 2026 BraxCode Digitals Foundation.
          <span className={styles.footerSub}> FORGEX DevStudio</span>
        </span>

        <nav aria-label="Footer navigation">
          <Link href="/welcome">Home</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </footer>
    </div>
  );
}
