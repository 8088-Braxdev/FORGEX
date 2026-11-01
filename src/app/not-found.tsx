
import Link from "next/link";
import { ArrowLeft, Code2, Home } from "lucide-react";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Code2 size={21} />
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
          <Link href="/" className={styles.primary}>
            <Home size={17} />
            Open IDE
          </Link>

          <Link href="/welcome" className={styles.secondary}>
            <ArrowLeft size={17} />
            Back to Home
          </Link>
        </div>

        <footer>
          BraxCode Digitals Foundation · FORGEX
        </footer>
      </div>
    </main>
  );
}
