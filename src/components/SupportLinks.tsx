import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/siteInfo";

export default function SupportLinks() {
  return (
    <nav className="fx-support-links" aria-label="Contact support">
      <a href={SUPPORT_WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="Contact FORGEX support on WhatsApp">WhatsApp: +255 618 811 359</a>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      <a href="/help">Help</a>
    </nav>
  );
}
