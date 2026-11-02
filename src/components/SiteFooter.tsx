import Link from "next/link";
import SupportLinks from "./SupportLinks";
import { COMPANY_URL } from "@/lib/siteInfo";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p>© {new Date().getFullYear()} <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer">BraxCode Digitals Foundation</a></p>
      <nav className={styles.navigation} aria-label="Product and legal information">
        <Link href="/">Home</Link><Link href="/help">Help</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
      </nav>
      <SupportLinks />
    </footer>
  );
}
