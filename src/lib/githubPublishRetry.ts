import { createHmac } from "node:crypto";

export class GitHubHTTPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GitHubHTTPError";
  }
}

export class PublishRecoveryError extends Error {
  constructor(
    message: string,
    public branch: string,
    public branchUrl: string,
    public status = 502
  ) {
    super(message);
    this.name = "PublishRecoveryError";
  }
}

type GitHubAPI = <T>(
  path: string,
  method?: string,
  payload?: unknown
) => Promise<T>;

type Ref = {
  ref: string;
  object: { type: string; sha: string };
};

type Commit = {
  sha: string;
  message: string;
  tree: { sha: string };
  parents: Array<{ sha: string }>;
};

type Pull = {
  number: number;
  head: {
    ref: string;
    sha: string;
    repo: { full_name: string } | null;
  };
  base: { ref: string };
};

export async function createOrReusePullRequest({
  github,
  key,
  actor,
  fullName,
  baseBranch,
  baseSha,
  treeSha,
  title,
  previousPRNumber,
  changedPaths,
}: {
  github: GitHubAPI;
  key: Uint8Array;
  actor: string;
  fullName: string;
  baseBranch: string;
  baseSha: string;
  treeSha: string;
  title: string;
  previousPRNumber: number | null;
  changedPaths: readonly string[];
}) {
  const shaPattern = /^(?:[a-f\d]{40}|[a-f\d]{64})$/i;

  if (!shaPattern.test(baseSha) || !shaPattern.test(treeSha)) {
    throw new Error("GitHub returned an invalid commit or tree SHA.");
  }

  const operation = createHmac("sha256", key)
    .update(JSON.stringify([
      "forgex-publish-v1",
      actor.toLowerCase(),
      fullName.toLowerCase(),
      baseBranch,
      baseSha.toLowerCase(),
      treeSha.toLowerCase(),
      title.trim(),
      previousPRNumber,
    ]))
    .digest("hex");

  const branch = `forgex/${operation}`;
  const branchUrl =
    `https://github.com/${fullName}/tree/${branch}`;
  const refPath = `/git/ref/heads/${branch}`;

  const conflict = (message: string) =>
    new PublishRecoveryError(message, branch, branchUrl, 409);

  const recoveryError = (error: unknown) =>
    error instanceof PublishRecoveryError
      ? error
      : new PublishRecoveryError(
          error instanceof Error
            ? error.message
            : "GitHub evidence is unavailable.",
          branch,
          branchUrl,
          error instanceof GitHubHTTPError &&
          [401, 403].includes(error.status)
            ? error.status
            : 502
        );

  async function readVerifiedRef(): Promise<Ref | null> {
    let ref: Ref;

    try {
      ref = await github<Ref>(refPath);
    } catch (error) {
      if (
        error instanceof GitHubHTTPError &&
        error.status === 404
      ) {
        return null;
      }

      throw error;
    }

    if (
      ref.ref !== `refs/heads/${branch}` ||
      ref.object?.type !== "commit" ||
      !shaPattern.test(ref.object.sha)
    ) {
      throw conflict(
        "The existing publish branch could not be verified."
      );
    }

    const commit = await github<Commit>(
      `/git/commits/${encodeURIComponent(ref.object.sha)}`
    );

    if (
      commit.sha !== ref.object.sha ||
      commit.tree?.sha !== treeSha ||
      commit.parents?.length !== 1 ||
      commit.parents[0].sha !== baseSha ||
      commit.message.trimEnd() !== title.trim()
    ) {
      throw conflict(
        "The existing publish branch differs from this request. " +
        "Review it on GitHub before continuing."
      );
    }

    return ref;
  }

  let ref = await readVerifiedRef();

  if (!ref) {
    const commit = await github<{ sha: string }>(
      "/git/commits",
      "POST",
      {
        message: title.trim(),
        tree: treeSha,
        parents: [baseSha],
      }
    );

    if (!shaPattern.test(commit.sha)) {
      throw new Error("GitHub returned an invalid commit SHA.");
    }

    try {
      await github("/git/refs", "POST", {
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
      });
    } catch (error) {
      // Another request or a lost response may have created this ref.
      ref = await readVerifiedRef();

      if (!ref) throw error;
    }

    if (!ref) {
      try {
        ref = await readVerifiedRef();
      } catch (error) {
        throw recoveryError(error);
      }
    }

    if (!ref) {
      throw new Error(
        "Publish branch creation could not be confirmed. " +
        "Retry the same request."
      );
    }
  }

  const [owner] = fullName.split("/");

  const query = new URLSearchParams({
    state: "all",
    head: `${owner}:${branch}`,
    base: baseBranch,
    per_page: "100",
  });

  const result = (number: number, reused: boolean) => ({
    ok: true,
    url: `https://github.com/${fullName}/pull/${number}`,
    number,
    branch,
    headSha: ref!.object.sha,
    reused,
  });

  async function findPull(): Promise<Pull | null> {
    const pulls = await github<Pull[]>(`/pulls?${query}`);

    if (!Array.isArray(pulls) || pulls.length >= 100) {
      throw conflict(
        "PR history is incomplete. Review this branch on GitHub."
      );
    }

    const matches = pulls.filter((pull) =>
      pull.head?.ref === branch &&
      pull.head.repo?.full_name.toLowerCase() ===
        fullName.toLowerCase() &&
      pull.base?.ref === baseBranch
    );

    if (matches.length > 1) {
      throw conflict(
        "Multiple PRs reference this branch. Review them on GitHub."
      );
    }

    const pull = matches[0] ?? null;

    if (
      pull &&
      (
        !Number.isSafeInteger(pull.number) ||
        pull.number < 1 ||
        pull.head.sha !== ref!.object.sha
      )
    ) {
      throw conflict(
        "The existing PR does not match the verified branch head."
      );
    }

    return pull;
  }

  const existing = await findPull().catch((error) => {
    throw recoveryError(error);
  });

  if (existing) return result(existing.number, true);

  const currentBase = await github<{
    commit: { sha: string };
  }>(
    `/branches/${encodeURIComponent(baseBranch)}`
  ).catch((error) => {
    throw recoveryError(error);
  });

  if (currentBase.commit?.sha !== baseSha) {
    throw conflict(
      "The base branch advanced during publishing. " +
      "The publish branch is preserved; reimport and review " +
      "before continuing."
    );
  }

  try {
    const pull = await github<Pull>("/pulls", "POST", {
      title: title.trim(),
      head: branch,
      base: baseBranch,
      body:
        `Created with FORGEX from ${baseSha.slice(0, 12)}.\n\n` +
        "Changed files:\n" +
        changedPaths.map((path) => `- ${path}`).join("\n") +
        "\n\nTests must be verified separately.",
    });

    if (
      !Number.isSafeInteger(pull.number) ||
      pull.number < 1 ||
      pull.head?.ref !== branch ||
      pull.head.sha !== ref.object.sha ||
      pull.head.repo?.full_name.toLowerCase() !==
        fullName.toLowerCase() ||
      pull.base?.ref !== baseBranch
    ) {
      throw new Error(
        "GitHub did not confirm the expected PR head and base."
      );
    }

    return result(pull.number, false);
  } catch (error) {
    try {
      const recovered = await findPull();

      if (recovered) return result(recovered.number, true);
    } catch (lookupError) {
      if (lookupError instanceof PublishRecoveryError) {
        throw lookupError;
      }
    }

    throw new PublishRecoveryError(
      (error instanceof Error ? `${error.message} ` : "") +
      "The branch is confirmed, but the PR creation outcome " +
      "is unknown. Check GitHub before retrying the same request.",
      branch,
      branchUrl,
      error instanceof GitHubHTTPError &&
      [401, 403].includes(error.status)
        ? error.status
        : 502
    );
  }
}