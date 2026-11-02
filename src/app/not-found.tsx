
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import styles from "./not-found.module.css";
import SiteFooter from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <img src="/brand/mark-96.png" alt="" width={40} height={40} />
          </span>
          <span>FORGEX DevStudio</span>
        </div>

        <span className={styles.code}>404</span>

        <h1>Page not found.</h1>

        <p>
          The page you requested does not exist
          or is no longer available.
          Check the address or return to FORGEX.
        </p>

        <div className={styles.actions}>
          <Link href="/studio" className={styles.primary}>
            <Home size={17} />
            Open IDE
          </Link>

          <Link href="/" className={styles.secondary}>
            <ArrowLeft size={17} />
            Back to Home
          </Link>
        </div>

        <SiteFooter />
      </div>
    </main>
  );
}
