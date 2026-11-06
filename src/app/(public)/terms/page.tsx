import type { Metadata } from "next";
import styles from "../public.module.css";
import { publicMetadata } from "@/lib/siteInfo";

export const metadata: Metadata = publicMetadata(
  "Terms of Service",
  "Terms governing the use of FORGEX DevStudio and its developer intelligence tools.",
  "/terms"
);

const WHATSAPP_NUMBER = "255618811359";
const WHATSAPP_DISPLAY = "+255 618 811 359";

export default function TermsPage() {
  return (
    <article className={styles.legalWrap}>
      <p className={styles.eyebrow}>Service Agreement</p>

      <h1 className={styles.legalTitle}>Terms of Service</h1>

      <p className={styles.legalLead}>
        These terms explain the conditions for using
        FORGEX DevStudio, a developer intelligence platform
        created by BraxCode Digitals Foundation.
        By using the service, you agree to these terms.
      </p>

      <p className={styles.updated}>
        Effective date: November 6, 2026
      </p>

      <div className={styles.legalBody}>
        <section className={styles.legalSection}>
          <h2>1. Acceptance and Scope</h2>
          <p>
            By accessing or using FORGEX DevStudio,
            you agree to these Terms of Service.
            If you do not agree, do not use the service.
          </p>
          <p>
            FORGEX is under active development.
            Available features, limitations, and integrations
            may change as the product evolves.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>2. Permitted Use</h2>
          <p>
            You may use FORGEX to inspect, edit, review,
            and analyze code that you own or are authorized
            to access.
          </p>
          <p>
            You must not use the service to access
            unauthorized repositories, interfere with
            its security, misuse connected services,
            or violate applicable laws and third-party rights.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>3. Your Source Code</h2>
          <p>
            You retain responsibility for the source files
            and other content you import or create.
            Using FORGEX does not transfer ownership
            of your code to BraxCode Digitals Foundation.
          </p>
          <p>
            You authorize the application to process
            the information needed to provide features
            you choose to use, including optional
            connected operations.
          </p>
          <p>
            You are responsible for maintaining backups.
            Local browser storage should not be treated
            as permanent or guaranteed storage.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>4. Analysis and Recommendations</h2>
          <p>
            FORGEX provides code findings, health scores,
            change analysis, and dependency information
            as development assistance.
          </p>
          <p>
            Results may contain false positives, false
            negatives, or incomplete information.
            They are not a substitute for testing,
            security audits, or professional judgment.
          </p>
          <p>
            You remain responsible for evaluating changes
            before applying or publishing them.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>5. Preview and Terminal Limitations</h2>
          <p>
            FORGEX Preview supports selected static HTML,
            CSS, and JavaScript workflows in a restricted
            browser environment.
          </p>
          <p>
            The built-in workspace terminal is not a
            general-purpose operating-system shell.
            It does not provide unrestricted Node.js,
            Python, Git, or system command execution.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>6. GitHub and External Integrations</h2>
          <p>
            Connected features may depend on GitHub,
            AI providers, weather services, and other
            third-party systems.
          </p>
          <p>
            You are responsible for the permissions
            you grant, the content you send, and compliance
            with applicable third-party terms.
          </p>
          <p>
            FORGEX is designed to require confirmation
            before publishing repository changes.
            Review changed files, target branches,
            and pull request details before approval.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>7. Availability and Warranties</h2>
          <p>
            FORGEX is provided on an as-available basis.
            Features may be unavailable, incomplete,
            or subject to errors.
          </p>
          <p>
            To the extent permitted by applicable law,
            no guarantee is made that analysis results
            will detect every issue or that the service
            will always be uninterrupted or error-free.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>8. Responsibility and Liability</h2>
          <p>
            You are responsible for decisions made using
            FORGEX output, including source-code changes,
            deployments, repository actions, and requests
            to third-party APIs.
          </p>
          <p>
            Nothing in these terms excludes or limits
            rights or liabilities that cannot legally
            be excluded or limited under applicable law.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>9. Changes to the Service or Terms</h2>
          <p>
            We may update the service and these terms
            as FORGEX evolves. Updated terms will be
            published with a revised effective date,
            and significant changes may be communicated
            through the service.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>10. Contact</h2>
          <p>
            Questions about these terms can be directed
            to BraxCode Digitals Foundation through
            WhatsApp:
          </p>
          <p>
            <a
              className={styles.inlineLink}
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Contact BraxCode Digitals Foundation on WhatsApp at ${WHATSAPP_DISPLAY}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: "7px",
                }}
              >
                <path d="M20.52 3.48A11.82 11.82 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.16 1.6 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.8 1.5h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.5-8.44ZM12.08 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.73.98.99-3.64-.23-.37a9.87 9.87 0 0 1-1.52-5.25c0-5.46 4.45-9.91 9.92-9.91a9.85 9.85 0 0 1 7.01 2.9 9.85 9.85 0 0 1 2.9 7.01c0 5.47-4.45 9.92-9.93 9.92Zm5.44-7.43c-.3-.15-1.76-.87-2.04-.97-.27-.1-.15-.25-.15-.42.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.8-1.67-2.1-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.63-.93-2.23-.25-.6-.5-.5-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.25 5.15 4.56.72.32 1.28.52 1.72.67.72.23 1.37.2 1.88.12.58-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
              </svg>
              {WHATSAPP_DISPLAY}
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}