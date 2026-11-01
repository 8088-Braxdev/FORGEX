
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Code2,
  FileCode2,
  FolderOpen,
  GitPullRequest,
  MonitorPlay,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import styles from "./public.module.css";

export const metadata: Metadata = {
  title: "FORGEX DevStudio | Developer Intelligence",
  description:
    "Understand your code. Predict the impact. Ship with confidence. Inspect source files, review risks, and prepare safer changes.",
};

const features = [
  {
    icon: Code2,
    title: "Integrated Code Editor",
    description:
      "Work with source files in a browser-based editor with syntax highlighting, file navigation, and editing tools.",
  },
  {
    icon: ScanSearch,
    title: "Code Intelligence",
    description:
      "Inspect source code for potential risks and receive actionable findings. Results are advisory, not a full security audit.",
  },
  {
    icon: FileCode2,
    title: "Dependency Impact",
    description:
      "Explore how changes to one file may affect other loaded files through static dependency analysis.",
  },
  {
    icon: MonitorPlay,
    title: "Web Preview & Diagnostics",
    description:
      "Preview supported static HTML, CSS, and JavaScript projects with console and network inspection tools.",
  },
  {
    icon: GitPullRequest,
    title: "GitHub Workflow",
    description:
      "Import supported repositories, review changes, and prepare pull requests through a confirmation-based workflow.",
  },
  {
    icon: FolderOpen,
    title: "Flexible Project Import",
    description:
      "Bring in source files, local folders, or supported GitHub repositories and work with them directly in FORGEX.",
  },
];

const sampleCode = [
  'const button = document.querySelector("#run");',
  "",
  'button?.addEventListener("click", () => {',
  '  console.log("Ready to inspect");',
  "});",
];

export default function WelcomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            Developer Intelligence Platform
          </p>

          <h1 className={styles.heroTitle}>
            Understand your code.
            <br />
            <span className={styles.accentText}>
              Predict the impact.
            </span>
            <br />
            Ship with confidence.
          </h1>

          <p className={styles.heroDescription}>
            FORGEX brings code inspection, change intelligence,
            project editing, and GitHub workflows into one
            focused workspace. Explore your source code and
            make better-informed development decisions.
          </p>

          <div className={styles.heroActions}>
            <Link href="/studio" className={styles.primaryButton}>
              Launch FORGEX IDE
              <ArrowRight size={17} />
            </Link>

            <Link
              href="#features"
              className={styles.secondaryButton}
            >
              Explore Features
            </Link>
          </div>
        </div>

        <div
          className={styles.preview}
          aria-label="Illustrative code editor preview"
        >
          <div className={styles.previewHeader}>
            <strong>FORGEX IDE</strong>
            <span>src/app.js</span>
          </div>

          <div className={styles.previewCode}>
            {sampleCode.map((line, index) => (
              <div className={styles.codeLine} key={index}>
                <span className={styles.codeNumber}>
                  {index + 1}
                </span>
                <code
                  className={
                    index === 3 ? styles.codeAccent : undefined
                  }
                >
                  {line || " "}
                </code>
              </div>
            ))}
          </div>

          <div className={styles.previewBottom}>
            <span>Illustrative workspace</span>
            <strong>Developer Intelligence</strong>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <p className={styles.eyebrow}>Built for Developers</p>

        <h2 className={styles.sectionHeading}>
          More than a code editor.
        </h2>

        <p className={styles.sectionDescription}>
          Move from source inspection to change review
          without switching between disconnected tools.
          FORGEX combines practical editing tools with
          advisory development intelligence.
        </p>

        <div className={styles.featureGrid}>
          {features.map(({ icon: Icon, title, description }) => (
            <article className={styles.featureCard} key={title}>
              <span className={styles.featureIcon}>
                <Icon size={21} />
              </span>

              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.bottomCta}>
        <div>
          <h2>Ready to inspect your next project?</h2>
          <p>
            Open the workspace and start with a file,
            local folder, or supported GitHub repository.
          </p>
        </div>

        <Link href="/studio" className={styles.primaryButton}>
          Open FORGEX
          <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}
