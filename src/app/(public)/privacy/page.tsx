import type { Metadata } from "next";
import styles from "../public.module.css";
import { publicMetadata } from "@/lib/siteInfo";

export const metadata: Metadata = publicMetadata(
  "Privacy Policy",
  "Learn how FORGEX DevStudio handles local workspaces, GitHub connections, API requests, and browser data.",
  "/privacy"
);

const WHATSAPP_NUMBER = "255618811359";
const WHATSAPP_DISPLAY = "+255 618 811 359";

export default function PrivacyPage() {
  return (
    <article className={styles.legalWrap}>
      <p className={styles.eyebrow}>Privacy & Data</p>

      <h1 className={styles.legalTitle}>Privacy Policy</h1>

      <p className={styles.legalLead}>
        FORGEX DevStudio is developed by BraxCode Digitals
        Foundation. This policy explains how the FORGEX
        Beta handles source files, workspace data, GitHub
        connections, browser storage, and optional external
        services.
      </p>

      <p className={styles.updated}>
        Effective date: November 6, 2026
      </p>

      <div className={styles.legalBody}>
        <section className={styles.legalSection}>
          <h2>1. Scope</h2>
          <p>
            This policy applies to FORGEX DevStudio, including
            its browser-based Studio, Preview, GitHub
            integration, API Tester, and other currently
            available features.
          </p>
          <p>
            This policy covers the browser-based FORGEX DevStudio.
            Any separately released extension or product will
            be covered by its applicable privacy information.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>2. Source Code and Local Workspaces</h2>
          <p>
            When you import files or folders, their contents
            are loaded into the FORGEX browser workspace.
            Editing, local inspection, and supported static
            analysis can operate within your browser.
          </p>
          <p>
            Workspace drafts, file contents, baseline data,
            preferences, and related settings may be stored
            in browser storage to support recovery and
            continued work. This storage is associated with
            your browser and device.
          </p>
          <p>
            Browser storage is not an encrypted secrets
            vault. Other people with access to your browser
            or device may be able to access stored
            information.
          </p>
          <p>
            Optional connected features may transmit
            selected information when you explicitly
            request the corresponding operation.
            Avoid importing passwords, private keys,
            access tokens, or other secrets.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>3. GitHub Integration</h2>
          <p>
            If you connect GitHub, FORGEX may process
            GitHub account information, authorized
            repositories, repository metadata, file contents,
            branches, commits, and pull request information
            required for the operations you request.
          </p>
          <p>
            Repository import and publishing involve
            communication with GitHub. Publishing changes
            requires confirmation in the application.
            The standard publishing workflow is intended
            to create a branch and pull request rather
            than directly modifying the default branch.
          </p>
          <p>
            GitHub permissions are requested through GitHub's
            authorization flow and are limited to the access
            needed for the connected features you choose to use.
            Review the permissions shown by GitHub before
            authorizing access.
          </p>
          <p>
            Authentication credentials are handled by the
            application's GitHub connection flow and its
            supporting infrastructure. Do not share access
            tokens or other credentials. Disconnect GitHub
            when you no longer want to use connected features.
          </p>
          <p>
            You can revoke FORGEX access through your
            GitHub account settings. Revocation may
            prevent connected features from working.
            It does not automatically delete repositories,
            commits, branches, or pull requests already
            created on GitHub.
          </p>
          <p>
            GitHub processes information under its own
            terms and privacy policy.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>4. Preview and External API Requests</h2>
          <p>
            FORGEX Preview supports static HTML, CSS,
            and JavaScript execution in a restricted
            environment. Preview does not represent a
            complete production hosting environment.
          </p>
          <p>
            Some Preview integrations may send requests
            through a FORGEX server-side network proxy.
            When such requests are enabled, the proxy
            may receive the destination URL, request
            headers, request body, and other information
            necessary to process the request. It may
            return response headers, status information,
            and response content to the Preview.
          </p>
          <p>
            Requests are processed to provide the requested
            feature and may be subject to operational security
            controls and infrastructure logging. Do not use
            the proxy to access private or sensitive systems
            or transmit secrets.
          </p>
          <p>
            Do not place API keys, authorization headers,
            passwords, or other secrets into Preview
            requests unless you understand the risks.
            Requests may disclose information to the
            destination service or the FORGEX infrastructure.
          </p>
          <ul>
            <li>
              <strong>Gemini AI:</strong> When Gemini AI is
              available and you use it, prompts and any
              source content you submit may be sent to
              Google for processing and returned results
              may appear in FORGEX. Avoid submitting
              confidential information or secrets.
            </li>
            <li>
              <strong>Open-Meteo:</strong> Weather requests
              may send requested location coordinates and
              weather parameters to Open-Meteo to provide
              weather results.
            </li>
            <li>
              <strong>GitHub:</strong> connected workflows
              exchange information with GitHub to perform
              repository operations requested by you.
            </li>
          </ul>
          <p>
            External providers process information under
            their own applicable terms and privacy
            practices. FORGEX does not control their
            independent processing.
          </p>
          <p>
            External providers handle submitted information
            under their own terms, privacy policies, and
            data-use practices. Consult the relevant provider
            information for details about its processing.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>5. Browser Storage, Sessions, and Logs</h2>
          <p>
            FORGEX may use browser storage for workspace
            recovery, editor preferences, project state,
            and workflow information. The application may
            also use Cache Storage and a service worker
            to support offline functionality and caching.
          </p>
          <p>
            Authentication features may use session cookies
            or other authentication-related storage to
            maintain sign-in and protect access.
          </p>
          <p>
            Hosting and infrastructure providers may
            process technical request information,
            including IP addresses, timestamps,
            requested URLs, request metadata, and
            error information, for service operation,
            troubleshooting, and security.
          </p>
          <p>
            Technical logs are retained as needed for service
            operation, troubleshooting, and security, subject
            to the practices of the hosting providers.
          </p>
          <p>
            FORGEX may use operational monitoring and
            diagnostic information to maintain, secure,
            and improve the service. Such information may
            include technical events and error details.
          </p>
          <p>
            Vercel may process technical information
            according to its infrastructure, security,
            and logging practices.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>6. Data Retention and Your Choices</h2>
          <p>
            Browser-stored workspace information may
            remain until you clear the relevant site
            data, the application replaces it, or
            the browser removes it.
          </p>
          <p>
            You can export a project backup and clear
            local browser data when appropriate.
            Clearing browser storage or site data
            may permanently remove unsaved work,
            preferences, and locally stored recovery
            information.
          </p>
          <p>
            Information processed by external services,
            including GitHub, Google, Open-Meteo,
            and Vercel, is subject to their applicable
            retention practices.
          </p>
          <p>
            Disconnecting GitHub does not automatically
            delete previously created commits or pull
            requests. Removing locally stored data
            does not necessarily delete information
            already transmitted to external services.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>7. Security</h2>
          <p>
            FORGEX is designed to support permission-
            controlled connected workflows and restricted
            Preview behavior. However, no online service,
            browser storage system, or transmission method
            can guarantee absolute security.
          </p>
          <p>
            Do not treat the local workspace as an
            encrypted secrets vault. You remain responsible
            for safeguarding sensitive source code,
            credentials, and access tokens.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>8. International Processing</h2>
          <p>
            FORGEX is operated by BraxCode Digitals
            Foundation in Tanzania. Hosting and external
            service providers may process information
            outside Tanzania, including through GitHub,
            Vercel, and Google services when applicable.
          </p>
          <p>
            These providers may process information in
            jurisdictions where they or their infrastructure
            operate, subject to their applicable safeguards
            and legal obligations.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>9. FORGEX VS Code Extension</h2>
          <p>
            This policy describes the browser-based
            FORGEX DevStudio. A separately distributed
            VS Code extension, if offered, may have
            additional product-specific information.
          </p>
          <p>
            Extension-specific data handling will be governed
            by the privacy information provided with that
            extension at the time it is distributed.
          </p>
          <p>
            Extension-specific processing and any
            applicable Marketplace privacy requirements
            will be described before the extension
            is made available.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>10. Data Protection in Tanzania</h2>
          <p>
            BraxCode Digitals Foundation operates
            FORGEX DevStudio and handles personal
            information in accordance with applicable
            data protection requirements, including
            Tanzania's Personal Data Protection Act, 2022.
          </p>
          <p>
            Subject to applicable law, you may request
            access to, correction of, or deletion of
            personal information associated with you,
            or raise a privacy concern.
          </p>
          <p>
            Such requests can be submitted through
            our official WhatsApp contact below.
            Requests may require identity verification
            and may be subject to legal or operational
            retention obligations.
          </p>
          <p>
            You may also contact the Personal Data
            Protection Commission of Tanzania to raise
            a data protection concern, where applicable.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>11. Data Sharing and Advertising</h2>
          <p>
            FORGEX does not sell personal information.
            Information may be shared with infrastructure
            providers and external services when needed
            to operate the service or perform an integration
            you request. FORGEX does not use personal
            information for third-party targeted advertising.
          </p>
          <p>
            Any disclosures to hosting providers,
            authentication providers, external APIs,
            or connected services should be limited
            to the purposes described in this policy
            and confirmed operational practices.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>12. Children and Age Restrictions</h2>
          <p>
            FORGEX is intended for users who are at least
            18 years old, or the age of majority in their
            jurisdiction, whichever is higher.
          </p>
          <p>
            FORGEX is not intended for children and does
            not knowingly collect personal information
            from children. If you believe a child has
            provided personal information, contact us
            through the WhatsApp channel below.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>13. Changes to This Policy</h2>
          <p>
            This policy may be updated when FORGEX
            introduces new functionality, changes
            its data handling, or adopts additional
            integrations.
          </p>
          <p>
            The effective date will be updated when
            changes are made. Significant changes
            should be communicated through the service
            or another appropriate channel.
          </p>
        </section>

        <section className={styles.legalSection}>
          <h2>14. Privacy Contact</h2>
          <p>
            For privacy questions, personal data
            requests, or related concerns, contact
            BraxCode Digitals Foundation through
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