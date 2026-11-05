const ENV_REFERENCE =
  /\b(?:process\.env|import\.meta\.env)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(['"`])([^'"`]+)\2\s*\])/g;

const SENSITIVE_ENV_NAME = /KEY|TOKEN|SECRET/i;

const SERVER_FILE = /(?:^|\/)(?:app|pages)\/api\//i;

const SERVER_CODE_PATTERNS = [
  /\b(?:express|fastify)\s*\(/,
  /\b(?:require\s*\(\s*|from\s+)['"](?:express|fastify)['"]/,
  /\bserver\s*\.\s*listen\s*\(/,
];

export type PreviewLimitSignals = {
  environmentSecrets: boolean;
  serverCode: boolean;
};

export function hasSensitiveEnvironmentReference(content: string): boolean {
  ENV_REFERENCE.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = ENV_REFERENCE.exec(content)) !== null) {
    const name = match[1] ?? match[3] ?? "";

    if (SENSITIVE_ENV_NAME.test(name)) return true;
  }

  return false;
}

export function detectPreviewLimits(
  files: readonly { path: string; content: string }[],
): PreviewLimitSignals {
  let environmentSecrets = false;
  let serverCode = false;

  for (const file of files) {
    if (!serverCode && SERVER_FILE.test(file.path)) serverCode = true;

    if (
      !serverCode &&
      SERVER_CODE_PATTERNS.some((pattern) => pattern.test(file.content))
    ) {
      serverCode = true;
    }

    if (!environmentSecrets && hasSensitiveEnvironmentReference(file.content)) {
      environmentSecrets = true;
    }

    if (environmentSecrets && serverCode) break;
  }

  return { environmentSecrets, serverCode };
}
