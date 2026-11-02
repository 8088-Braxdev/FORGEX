
import type { Metadata } from "next";
import styles from "../public.module.css";
import { publicMetadata, SUPPORT_EMAIL } from "@/lib/siteInfo";

export const metadata: Metadata = publicMetadata("Terms of Service", "Terms governing the use of FORGEX DevStudio and its developer intelligence tools.", "/terms");

const contactEmail =
  SUPPORT_EMAIL;

export default function TermsPage() {
  return (
    <article className={styles.legalWrap}>
      <p className={styles.eyebrow}>Service Agreement</p>

      <h1 className={styles.legalTitle}>Terms of Service</h1>

      <p className={styles.legalLead}>
        These terms explain the conditions for using
        FORGEX DevStudio, a developer intelligence platform
        created by BraxCode Digitals Foundation.
        Please review them before using the service.
      </p>

      <p className={styles.updated}>
        Effective date: November 2, 2026
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
            FORGEX is currently under active development.
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
            They are not a substitute for manual review,
            testing, security audits, or professional judgment.
          </p>
          <p>
            You remain responsible for evaluating changes
            before applying or publishing them.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>5. Preview and Terminal Limitations</h2>
          <p>
            The current FORGEX Preview supports selected
            static HTML, CSS, and JavaScript workflows
            in a restricted browser environment.
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
            You should review changed files, target branches,
            and pull request details before approval.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>7. Availability and Warranties</h2>
          <p>
            FORGEX is provided on an as-available basis.
            During development, features may be unavailable,
            incomplete, or subject to errors.
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
            Any limitations of liability must be interpreted
            consistently with mandatory consumer,
            privacy, and other applicable laws.
            Nothing in these terms excludes rights
            that cannot legally be excluded.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>9. Changes to the Service or Terms</h2>
          <p>
            We may update the service and these terms
            as FORGEX evolves. Updated terms should be
            published with a revised effective date,
            and significant changes should be communicated
            through the service.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>10. Contact</h2>
            <p>
              Questions about these terms can be sent to{" "}
              <a
                className={styles.inlineLink}
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
              .
            </p>

        </section>
      </div>
    </article>
  );
}
