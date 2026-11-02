import { permanentRedirect } from "next/navigation";

export default function LegacyWelcomePage() {
  permanentRedirect("/");
}
