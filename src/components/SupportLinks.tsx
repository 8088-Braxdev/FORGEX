import {  SUPPORT_WHATSAPP } from "@/lib/siteInfo";
import { Mail, MessageCircle } from "lucide-react";
import styles from "./SupportLinks.module.css";

export default function SupportLinks() {
  return (
    <nav className={styles.links} aria-label="Contact support">
      <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" title="+255 618 811 359" aria-label="WhatsApp support: +255 618 811 359"><MessageCircle size={15} aria-hidden="true" /> WhatsApp</a>

    </nav>
  );
}
