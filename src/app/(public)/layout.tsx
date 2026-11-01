
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
          href="/"
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
          <Link href="/#features">Features</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/studio" className={styles.navPrimary}>
            Open IDE <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>

      <main className={styles.pageContent}>{children}</main>

      <footer className={styles.footer}>
        <span>
          © 2026{" "}
          <a
            href="https://braxcode.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="BraxCode Digitals Foundation website"
          >
            BraxCode Digitals Foundation
          </a>
          .<span className={styles.footerSub}> FORGEX DevStudio</span>
        </span>

        <nav aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a
            href="https://wa.me/255618811359"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact FORGEX support on WhatsApp"
          >
            WhatsApp 0618811359
          </a>
          <a href="mailto:braxtonbruzzzy@gmail.com">Email support</a>
        </nav>
      </footer>
    </div>
  );
}
