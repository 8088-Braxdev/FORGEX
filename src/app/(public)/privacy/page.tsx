
import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | FORGEX DevStudio",
  description:
    "Learn how FORGEX DevStudio handles local workspaces, GitHub connections, API requests, and browser data.",
};

const contactEmail =
  process.env.NEXT_PUBLIC_FORGEX_SUPPORT_EMAIL?.trim() ||
  "braxtonbruzzzy@gmail.com";

export default function PrivacyPage() {
  return (
    <article className={styles.legalWrap}>
      <p className={styles.eyebrow}>Privacy & Data</p>

      <h1 className={styles.legalTitle}>Privacy Policy</h1>

      <p className={styles.legalLead}>
        FORGEX DevStudio is developed by BraxCode Digitals
        Foundation. This policy describes how the current
        FORGEX beta handles source files, workspace data,
        connected services, and optional external API requests.
      </p>

      <p className={styles.updated}>
        Effective date: October 30, 2026
      </p>

      <div className={styles.legalBody}>
        <section className={styles.legalSection}>
          <h2>1. Scope</h2>
          <p>
            This policy applies to FORGEX DevStudio and
            its currently available browser-based features.
            Future cloud workspaces, account storage, or
            additional integrations may require changes
            to this policy before they are released.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>2. Source Code and Local Workspaces</h2>
          <p>
            When you import files or folders, their contents
            are loaded into the FORGEX browser workspace.
            Editing, local inspection, and supported static
            analysis can operate within the browser.
          </p>
          <p>
            Workspace drafts, file contents, baseline data,
            and related settings may be stored in your
            browser to support recovery. This storage is
            associated with your browser and device.
          </p>
          <p>
            Optional connected features may transmit
            selected information when you explicitly
            request the corresponding operation.
            Avoid adding passwords, private keys,
            or other secrets to files you import.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>3. GitHub Integration</h2>
          <p>
            If you connect GitHub, FORGEX may access
            account information, authorized repositories,
            file contents, branches, commits, and pull
            request information needed for the operations
            you choose.
          </p>
          <p>
            Repository import and publishing may involve
            communication between the FORGEX server
            and GitHub. Publishing changes requires
            explicit confirmation in the application.
            You can revoke application access through
            your GitHub account settings.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>4. External API Requests</h2>
          <p>
            FORGEX supports selected optional API requests
            from its Preview environment.
          </p>
          <ul>
            <li>
              <strong>Gemini AI:</strong> prompts that you approve
              may be transmitted to the configured AI provider
              to generate a response.
            </li>
            <li>
              <strong>Open-Meteo:</strong> approved weather requests
              may send latitude and longitude values
              to the weather provider.
            </li>
            <li>
              <strong>GitHub:</strong> connected workflows exchange
              information with GitHub to perform requested
              repository operations.
            </li>
          </ul>
          <p>
            External providers process information according
            to their own terms and privacy practices.
            Do not submit sensitive information through
            an AI prompt unless you understand and accept
            the consequences.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>5. Browser Storage, Sessions, and Logs</h2>
          <p>
            FORGEX may use browser storage for workspace
            recovery, editor preferences, and workflow state.
            Authentication features may use session cookies.
          </p>
          <p>
            Servers and hosting services may process technical
            request information for operation, troubleshooting,
            and security. The precise logging configuration
            and retention periods must be confirmed before
            public production release.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>6. Data Retention and Your Choices</h2>
          <p>
            Browser-stored workspace data may remain until
            you clear the relevant site data, the application
            replaces it, or the browser removes it.
          </p>
          <p>
            You can export a project backup and clear local
            browser data when appropriate. Clearing browser
            data may permanently remove unsaved work.
          </p>
          <p>
            Information processed by external services,
            including GitHub, Gemini, and Open-Meteo,
            is subject to their applicable retention practices.
            Disconnecting GitHub does not automatically
            delete previously created commits or pull requests.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>7. Security</h2>
          <p>
            FORGEX is designed with permission-controlled
            connected workflows and restricted preview
            behavior. However, no online service or browser
            storage system can guarantee absolute security.
          </p>
          <p>
            Do not treat the local workspace as an encrypted
            secrets vault. You remain responsible for
            safeguarding sensitive source code and credentials.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>8. International Processing</h2>
          <p>
            Optional external providers and hosting services
            may process information outside your country.
            The applicable processing locations and
            contractual safeguards must be reviewed
            as part of production readiness.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>9. Changes to This Policy</h2>
          <p>
            This policy may be updated when FORGEX introduces
            new functionality, changes its data handling,
            or adopts additional integrations.
            Significant changes should be communicated
            through the service.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>10. Privacy Contact</h2>
          {contactEmail ? (
            <p>
              For privacy questions or data-related requests,
              contact{" "}
              <a
                className={styles.inlineLink}
                href={`mailto:${contactEmail}`}
              >
                {contactEmail}
              </a>
              .
            </p>
          ) : (
            <p className={styles.reviewNote}>
              A verified privacy contact email has not yet
              been configured. This must be completed
              before public release.
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
