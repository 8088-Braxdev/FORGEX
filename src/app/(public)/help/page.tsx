import type { Metadata } from "next";
import Link from "next/link";
import { Code2, FolderOpen, Github, MonitorPlay, ShieldCheck } from "lucide-react";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Help & Support | FORGEX DevStudio",
  description:
    "How to use FORGEX DevStudio: import files, connect GitHub, preview projects, and get support.",
};

export default function HelpPage() {
  return (
    <article className={styles.legalWrap}>
      <p className={styles.eyebrow}>Help & Support</p>
      <h1 className={styles.legalTitle}>Using FORGEX DevStudio</h1>
      <p className={styles.legalLead}>
        FORGEX is a browser-based developer intelligence workspace. You can
        inspect and edit source code, run static previews, analyze risks, and
        prepare GitHub pull requests. Contact support using the details below.
      </p>

      <div className={styles.legalBody}>
        <section className={styles.legalSection}>
          <h2>
            <FolderOpen size={18} /> Importing a project
          </h2>
          <p>
            Use Open Folder to load files from your computer, or paste a public
            GitHub repository URL. Files keep their relative paths. Private
            repositories require connecting your GitHub account.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>
            <Code2 size={18} /> Editing and analysis
          </h2>
          <p>
            Open files in tabs, edit in the Monaco editor, then run Analyze to
            receive advisory findings. Results are heuristic and not a full
            security audit.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>
            <MonitorPlay size={18} /> Static preview and approved APIs
          </h2>
          <p>
            Preview supports static HTML, CSS, and JavaScript. It does not run
            npm, Node servers, or framework build steps. Local images and pages
            resolve relative to the project. Browser security limits apply to
            network requests.
          </p>
          <p>
            Approved preview APIs (Gemini AI and Open-Meteo weather) require
            explicit user consent and are available only in development builds.
            Imported projects can use the injected{" "}
            <code>window.forgexPreview.ai(prompt)</code> and{" "}
            <code>window.forgexPreview.weather(lat, lon)</code> helpers instead
            of inline onclick handlers. Other network requests are blocked by
            the sandbox.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>
            <Github size={18} /> GitHub workflow
          </h2>
          <p>
            Connect GitHub (optional), import a repository, review changes, and
            create a pull request on a new branch. FORGEX never pushes directly
            to your default branch. Publishing requires explicit confirmation.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>
            <ShieldCheck size={18} /> Safety notes
          </h2>
          <p>
            Imported code runs in a restricted preview sandbox. Do not import
            secrets, private keys, or credentials. Clearing browser data may
            remove unsaved work; export a backup when needed.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>Support</h2>
          <p>
            WhatsApp:{" "}
            <a
              className={styles.inlineLink}
              href="https://wa.me/255618811359"
              target="_blank"
              rel="noopener noreferrer"
            >
              0618811359
            </a>
          </p>
          <p>
            Email:{" "}
            <a
              className={styles.inlineLink}
              href="mailto:braxtonbruzzzy@gmail.com"
            >
              braxtonbruzzzy@gmail.com
            </a>
          </p>
          <p>
            Company:{" "}
            <a
              className={styles.inlineLink}
              href="https://braxcode.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              BraxCode Digitals Foundation
            </a>
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>Return to the app</h2>
          <p>
            <Link className={styles.inlineLink} href="/studio">
              Open FORGEX IDE
            </Link>{" "}
            or{" "}
            <Link className={styles.inlineLink} href="/">
              return to the landing page
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}