type TrackedPRState = {
  number: number;
  state: "open" | "closed";
  merged: boolean;
};

export function canCreatePullRequest({
  historyReady,
  prNumber,
  status,
  hasPublishedLink,
}: {
  historyReady: boolean;
  prNumber: number | null;
  status: TrackedPRState | null;
  hasPublishedLink: boolean;
}): boolean {
  if (!historyReady) return false;

  if (prNumber === null) {
    return !hasPublishedLink;
  }

  return (
    status !== null &&
    status.number === prNumber &&
    status.state === "closed" &&
    status.merged === false
  );
}

export function sameHeadCommit(
  expected: string,
  actual: string
): boolean {
  const sha = /^(?:[a-f\d]{40}|[a-f\d]{64})$/i;

  return (
    typeof expected === "string" &&
    typeof actual === "string" &&
    sha.test(expected) &&
    sha.test(actual) &&
    expected.toLowerCase() === actual.toLowerCase()
  );
}

export function readPullRequestNumber(
  repoFullName: string,
  value: unknown
): number | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    const prefix = `/${repoFullName}/pull/`;

    if (
      url.origin !== "https://github.com" ||
      url.username ||
      url.password ||
      !url.pathname.toLowerCase().startsWith(prefix.toLowerCase())
    ) {
      return null;
    }

    const text = url.pathname.slice(prefix.length).replace(/\/$/, "");
    const number = Number(text);

    return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(number)
      ? number
      : null;
  } catch {
    return null;
  }
}