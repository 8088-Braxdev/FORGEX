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
import { redirect } from "next/navigation";
import { publicMetadata, SITE_ORIGIN } from "@/lib/siteInfo";

export const metadata: Metadata = publicMetadata(
  "FORGEX DevStudio — Developer Intelligence",
  "Understand your code. Predict the impact. Ship with confidence. Inspect source files, review risks, and prepare safer changes.",
  "/",
);

const features = [
  {
    icon: Code2,
    title: "Integrated Code Editor",
    description:
      "Work with source files in an integrated browser-based editor with syntax highlighting, file navigation, and editing tools.",
  },
  {
    icon: ScanSearch,
    title: "Code Intelligence",
    description:
      "Analyze source code for potential risks, identify suspicious patterns, and review actionable findings to support better development decisions.",
  },
  {
    icon: FileCode2,
    title: "Dependency Impact",
    description:
      "Explore file relationships and understand how changes to one file may affect connected parts of your project.",
  },
  {
    icon: MonitorPlay,
    title: "Web Preview & Diagnostics",
    description:
      "Preview supported web projects, inspect console output, investigate network activity, and troubleshoot development issues.",
  },
  {
    icon: GitPullRequest,
    title: "GitHub Workflow",
    description:
      "Connect GitHub, import supported repositories, review changes, and prepare pull requests through a confirmation-based workflow.",
  },
  {
    icon: FolderOpen,
    title: "Flexible Project Import",
    description:
      "Import source files, local folders, or supported GitHub repositories and manage your project directly inside FORGEX.",
  },
];

const sampleCode = [
  'const button = document.querySelector("#run");',
  "",
  'button?.addEventListener("click", () => {',
  '  console.log("Ready to inspect");',
  "});",
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FORGEX DevStudio",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description:
    "Inspect source code, investigate potential risks, understand change impact, and build with confidence.",
  url: SITE_ORIGIN,
  publisher: {
    "@type": "Organization",
    name: "BraxCode Digitals Foundation",
    url: "https://braxcode.com",
  },
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  // Preserve callbacks issued before the studio route was introduced.
  if (query.github === "connected" || query.github === "failed") {
    redirect(`/studio?github=${query.github}`);
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
            FORGEX brings code inspection, dependency
            intelligence, project editing, and GitHub
            workflows into one focused workspace.
            Understand your source code, investigate
            potential issues, and make more informed
            development decisions.
          </p>

          <div className={styles.heroActions}>
            <Link href="/studio" className={styles.primaryButton}>
              Open FORGEX
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
          FORGEX combines practical editing capabilities
          with development intelligence in one workspace.
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
            Open your workspace and start with source
            files, a local folder, or a supported
            GitHub repository.
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