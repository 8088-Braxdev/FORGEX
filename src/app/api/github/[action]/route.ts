import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { safeIdePath } from "@/lib/ideCore";
import {
  createOrReusePullRequest,
  GitHubHTTPError,
  PublishRecoveryError,
} from "@/lib/githubPublishRetry";
export const runtime = "nodejs";

const FLOW = "forgex_gh_flow";
const SESSION = "forgex_gh_session";
const secure = process.env.NODE_ENV === "production";

type Flow = {
  state: string;
  verifier: string;
  expiresAt: number;
};

type Session = {
  token: string;
  login: string;
  expiresAt: number;
};

function cryptoKey() {
  const value = Buffer.from(process.env.GITHUB_COOKIE_KEY ?? "", "base64url");

  if (value.length !== 32) {
    throw new Error("Invalid GITHUB_COOKIE_KEY");
  }

  return value;
}

function encrypt(value: Flow | Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);

  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function decrypt<T extends { expiresAt: number }>(raw?: string): T | null {
  if (!raw) return null;

  try {
    const data = Buffer.from(raw, "base64url");
    if (data.length < 29) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      cryptoKey(),
      data.subarray(0, 12),
    );

    decipher.setAuthTag(data.subarray(12, 28));

    const value = JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    ) as T;

    return value &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > Date.now()
      ? value
      : null;
  } catch {
    return null;
  }
}

function config() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const rawOrigin = process.env.FORGEX_APP_ORIGIN;

  if (!clientId || !clientSecret || !rawOrigin) {
    throw new Error("Missing GitHub App config");
  }

  const url = new URL(rawOrigin);

  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && url.hostname !== "localhost")
  ) {
    throw new Error("Untrusted FORGEX_APP_ORIGIN");
  }

  return {
    clientId,
    clientSecret,
    origin: url.origin,
    callback: `${url.origin}/api/github/callback`,
  };
}

async function connect() {
  try {
    const cfg = config();

    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");

    const url = new URL("https://github.com/login/oauth/authorize");

    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", cfg.callback);
    url.searchParams.set("state", state);
    url.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier).digest("base64url"),
    );
    url.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(url, 302);

    response.cookies.set(
      FLOW,
      encrypt({
        state,
        verifier,
        expiresAt: Date.now() + 600_000,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: 600,
      },
    );

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Configure GitHub App in .env.local first." },
      { status: 503 },
    );
  }
}

async function callback(request: NextRequest) {
  let cfg: ReturnType<typeof config>;

  try {
    cfg = config();
  } catch {
    return NextResponse.json(
      { error: "GitHub App is not configured" },
      { status: 503 },
    );
  }

  const finish = (result: "connected" | "failed") => {
    const response = NextResponse.redirect(
      new URL(`/studio?github=${result}`, cfg.origin),
      302,
    );

    response.cookies.delete(FLOW);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const flow = decrypt<Flow>(request.cookies.get(FLOW)?.value);

  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  if (!flow || !state || state !== flow.state || !code) {
    return finish("failed");
  }

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          redirect_uri: cfg.callback,
          code_verifier: flow.verifier,
        }),
      },
    );

    if (!tokenResponse.ok) return finish("failed");

    const token = (await tokenResponse.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!token.access_token || token.error) {
      return finish("failed");
    }

    const profileResponse = await fetch("https://api.github.com/user", {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token.access_token}`,
      },
    });

    if (!profileResponse.ok) return finish("failed");

    const profile = (await profileResponse.json()) as {
      login?: string;
    };

    if (!profile.login) return finish("failed");

    const lifetime = Math.max(1, Math.min(token.expires_in ?? 7200, 7200));

    const response = finish("connected");

    response.cookies.set(
      SESSION,
      encrypt({
        token: token.access_token,
        login: profile.login,
        expiresAt: Date.now() + lifetime * 1000,
      }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: lifetime,
      },
    );

    return response;
  } catch {
    return finish("failed");
  }
}

async function repositories(request: NextRequest) {
  const session = decrypt<Session>(request.cookies.get(SESSION)?.value);

  if (!session) {
    return NextResponse.json(
      {
        error: "Connect GitHub to view your repositories.",
      },
      { status: 401 },
    );
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const response = await fetch(
      "https://api.github.com/user/installations?per_page=100",
      {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );

    if (response.status === 401) {
      return NextResponse.json(
        {
          error: "GitHub session expired. Reconnect your account.",
        },
        { status: 401 },
      );
    }

    if (!response.ok) {
      throw new Error("Unable to list installations");
    }

    const data = (await response.json()) as {
      total_count: number;
      installations: Array<{ id: number }>;
    };
    const installationsFound = data.total_count;
    const installations = data.installations.slice(0, 5);

    const repositories: Array<{
      fullName: string;
      defaultBranch: string;
      private: boolean;
      archived: boolean;
    }> = [];

    let partial = data.total_count > 5;

    for (const installation of installations) {
      const result = await fetch(
        `https://api.github.com/user/installations/${installation.id}/repositories?per_page=100`,
        {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        },
      );

      if (!result.ok) {
        throw new Error("Unable to list installation repositories");
      }

      const payload = (await result.json()) as {
        total_count: number;
        repositories: Array<{
          full_name: string;
          default_branch: string;
          private: boolean;
          archived: boolean;
        }>;
      };

      if (payload.total_count > 100) partial = true;

      for (const repo of payload.repositories) {
        repositories.push({
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          private: repo.private,
          archived: repo.archived,
        });
      }
    }

    const unique = [
      ...new Map(repositories.map((repo) => [repo.fullName, repo])).values(),
    ];

    unique.sort((a, b) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json(
      {
        repositories: unique,
        partial,
        installationsFound,
        repositoriesFound: unique.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Cannot load GitHub repositories. Check permissions and try again.",
      },
      { status: 502 },
    );
  }
}

async function importPrivateRepository(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  const session = decrypt<Session>(request.cookies.get(SESSION)?.value);

  if (!session) {
    return NextResponse.json(
      { error: "Connect GitHub again to import private repositories." },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);

  const input =
    body && typeof body === "object" && "url" in body ? body.url : null;

  if (typeof input !== "string" || input.length > 300) {
    return NextResponse.json(
      { error: "Enter a GitHub repository URL." },
      { status: 400 },
    );
  }

  let owner: string;
  let repo: string;

  try {
    const url = new URL(input.trim());
    const parts = url.pathname.split("/").filter(Boolean);

    if (
      url.origin !== "https://github.com" ||
      parts.length !== 2 ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error("Invalid GitHub URL");
    }

    [owner, repo] = parts;
    repo = repo.replace(/\.git$/i, "");

    if (
      !/^[A-Za-z0-9-]{1,39}$/.test(owner) ||
      !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
      repo.startsWith(".")
    ) {
      throw new Error("Invalid repository name");
    }
  } catch {
    return NextResponse.json(
      { error: "Use https://github.com/owner/repo." },
      { status: 400 },
    );
  }

  const base =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function githubRead<T>(suffix: string): Promise<T> {
    const response = await fetch(base + suffix, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 401) {
      throw new Error("GitHub session expired. Reconnect GitHub.");
    }

    if (response.status === 403) {
      throw new Error("GitHub denied access. Check FORGEX App permissions.");
    }

    if (response.status === 404) {
      throw new Error("Repository or Git data is not accessible to FORGEX.");
    }

    if (!response.ok) {
      throw new Error(`GitHub API returned HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
  }

  type TreeEntry = {
    path: string;
    type: string;
    mode?: string;
    size?: number;
    sha?: string;
  };

  try {
    const info = await githubRead<{
      default_branch?: string;
    }>("");

    if (!info.default_branch) {
      throw new Error("Repository has no default branch.");
    }

    const branch = await githubRead<{
      commit?: {
        sha?: string;
        commit?: {
          tree?: { sha?: string };
        };
      };
    }>(`/branches/${encodeURIComponent(info.default_branch)}`);

    const commitSha = branch.commit?.sha;
    const treeSha = branch.commit?.commit?.tree?.sha;

    if (!commitSha || !treeSha) {
      throw new Error("Cannot identify repository commit and tree.");
    }

    const tree = await githubRead<{
      tree?: TreeEntry[];
      truncated?: boolean;
    }>(`/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);

    if (!Array.isArray(tree.tree)) {
      throw new Error("GitHub returned no file tree.");
    }

    const supported =
      /\.(js|jsx|mjs|cjs|ts|tsx|py|json|css|html|htm|md|scss|yml|yaml)$/i;

    const ignored =
      /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|vendor)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\.(js|css)$|\.snap$/i;

    const eligible = tree.tree.filter(
      (entry) =>
        entry.type === "blob" &&
        entry.mode !== "120000" &&
        typeof entry.sha === "string" &&
        /^[a-f0-9]{40,64}$/i.test(entry.sha) &&
        typeof entry.size === "number" &&
        entry.size >= 0 &&
        entry.size <= 125_000 &&
        supported.test(entry.path) &&
        !ignored.test(entry.path) &&
        !entry.path.split("/").some((segment) => segment.startsWith(".env")) &&
        !!safeIdePath(entry.path),
    );

    const selected = eligible.slice(0, 60);

    const files: {
      path: string;
      content: string;
    }[] = [];

    let skipped = eligible.length - selected.length;
    let totalChars = 0;

    for (let index = 0; index < selected.length; index += 4) {
      const batch = await Promise.all(
        selected.slice(index, index + 4).map(async (entry) => {
          try {
            const blob = await githubRead<{
              content?: string;
              encoding?: string;
            }>(`/git/blobs/${encodeURIComponent(entry.sha!)}`);

            if (blob.encoding !== "base64" || !blob.content) {
              return null;
            }

            const bytes = Buffer.from(
              blob.content.replace(/\s/g, ""),
              "base64",
            );

            if (bytes.length > 125_000) {
              return null;
            }

            const content = bytes.toString("utf8");

            if (content.includes("\0")) {
              return null;
            }

            return {
              path: entry.path,
              content,
            };
          } catch {
            return null;
          }
        }),
      );

      for (const file of batch) {
        if (!file || totalChars + file.content.length > 2_000_000) {
          skipped++;
          continue;
        }

        files.push(file);
        totalChars += file.content.length;
      }
    }

    if (!files.length) {
      throw new Error("No supported source files were imported.");
    }

    return NextResponse.json(
      {
        repository: `${owner}/${repo}`,
        branch: info.default_branch,
        commitSha,
        files,
        skipped,
        partial: !!tree.truncated || skipped > 0,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Private import failed.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

async function publishPullRequest(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const session = decrypt<Session>(request.cookies.get(SESSION)?.value);

  if (!session) {
    return NextResponse.json(
      { error: "Connect GitHub first." },
      { status: 401 },
    );
  }

  const raw: unknown = await request.json().catch(() => null);

  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const body = raw as Record<string, unknown>;

  const identity = body.identity as {
    fullName: string;
    branch: string;
    commitSha: string;
    partial: boolean;
    importedPaths: string[];
  } | null;

  const title = body.title;
  const priorPR =
    typeof body.previousPRNumber === "number" ? body.previousPRNumber : null;

  const validPriorPR =
    body.previousPRNumber === undefined ||
    body.previousPRNumber === null ||
    (priorPR !== null &&
      Number.isSafeInteger(priorPR) &&
      priorPR > 0 &&
      priorPR <= 999_999_999);
  const validRepo =
    identity &&
    typeof identity.fullName === "string" &&
    /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(identity.fullName) &&
    typeof identity.branch === "string" &&
    /^(?!\/|.*\.\.)(?!.*\/\/)[A-Za-z0-9._/-]{1,150}$/.test(identity.branch) &&
    typeof identity.commitSha === "string" &&
    /^[a-f0-9]{40,64}$/i.test(identity.commitSha) &&
    identity.partial === false &&
    Array.isArray(identity.importedPaths) &&
    identity.importedPaths.every((p) => typeof p === "string");

  if (
    !validRepo ||
    !validPriorPR ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 100
  ) {
    return NextResponse.json(
      {
        error: "Valid complete repository identity and PR title required.",
      },
      { status: 400 },
    );
  }

  type File = {
    path: string;
    content: string;
  };

  function parseFiles(value: unknown): Map<string, string> {
    if (!Array.isArray(value) || value.length > 80) {
      throw new Error("Too many files.");
    }

    const result = new Map<string, string>();
    const names = new Set<string>();
    let total = 0;

    for (const file of value as File[]) {
      if (
        !file ||
        typeof file.path !== "string" ||
        typeof file.content !== "string"
      ) {
        throw new Error("Invalid source file.");
      }

      const p = safeIdePath(file.path);

      if (
        !p ||
        p !== file.path ||
        !/\.(js|jsx|mjs|cjs|ts|tsx|py|json|css|html|htm|md|scss|yml|yaml)$/i.test(
          p,
        ) ||
        p.split("/").some((x) => x.toLowerCase().startsWith(".env")) ||
        /^\.github\/workflows\//i.test(p) ||
        /(^|\/)(node_modules|\.git|\.next|dist|build|vendor)(\/|$)/i.test(p)
      ) {
        throw new Error(`Unsafe file path: ${file.path}`);
      }

      const bytes = Buffer.byteLength(file.content, "utf8");

      if (bytes > 125_000 || file.content.includes("\0")) {
        throw new Error(`File too large/binary: ${p}`);
      }

      if (names.has(p.toLowerCase())) {
        throw new Error(`Duplicate file: ${p}`);
      }

      names.add(p.toLowerCase());
      result.set(p, file.content);

      total += bytes;

      if (total > 2_000_000) {
        throw new Error("Workspace too large.");
      }
    }

    return result;
  }

  let original: Map<string, string>;
  let working: Map<string, string>;

  try {
    original = parseFiles(body.baselineFiles);
    working = parseFiles(body.files);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid files.",
      },
      { status: 400 },
    );
  }

const importedPaths = identity.importedPaths as string[];
const imported = new Set(importedPaths);

const invalidImportedPaths =
  importedPaths.length === 0 ||
  importedPaths.length > 80 ||
  imported.size !== importedPaths.length ||
  importedPaths.some(
    (path) =>
      !safeIdePath(path) ||
      safeIdePath(path) !== path
  );

const baselineMismatch =
  original.size !== imported.size ||
  [...original.keys()].some(
    (path) => !imported.has(path)
  );

if (invalidImportedPaths || baselineMismatch) {
  return NextResponse.json(
    {
      error:
        "GitHub baseline does not match the original imported paths. " +
        "Export your changes and reimport the repository.",
    },
    {
      status: 409,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

  const changed = [...new Set([...original.keys(), ...working.keys()])]
    .sort()
    .filter((path) => original.get(path) !== working.get(path));

  if (!changed.length || changed.length > 20) {
    return NextResponse.json(
      { error: "Review 1–20 changed files per PR." },
      { status: 400 },
    );
  }

  const [owner, repo] = identity.fullName.split("/");

  const baseUrl =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function github<T>(
    path: string,
    method = "GET",
    payload?: unknown,
  ): Promise<T> {
    const response = await fetch(baseUrl + path, {
      method,
      headers: {
        ...headers,
        ...(payload === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      const message =
        response.status === 401
          ? "GitHub session expired. Reconnect."
          : response.status === 403
            ? "GitHub denied access. Check FORGEX App permissions and reconnect."
            : `GitHub ${method} ${path.split("?")[0]} failed ` +
              `(HTTP ${response.status}).`;

      throw new GitHubHTTPError(response.status, message);
    }

    return (await response.json()) as T;
  }
  try {
  if (priorPR !== null) {
    const previous = await github<{
      state: string;
      merged: boolean;
      base?: { ref?: string };
    }>(`/pulls/${priorPR}`);

    if (
      previous.state !== "closed" ||
      previous.merged !== false ||
      previous.base?.ref !== identity.branch
    ) {
      return NextResponse.json(
        {
          error:
            "The previous PR must be closed without merge " +
            "and target the same base branch.",
        },
        {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  }
  
    const branchName = identity.branch as string;
    const baseSha = identity.commitSha as string;

    const branch = await github<{
      commit: {
        sha: string;
        commit: { tree: { sha: string } };
      };
    }>(`/branches/${encodeURIComponent(branchName)}`);

    if (branch.commit.sha !== baseSha) {
      return NextResponse.json(
        {
          error:
            "Remote branch has advanced since import. " +
            "Export your edits, reimport and review " +
            "before publishing.",
        },
        { status: 409 },
      );
    }

    const baseTree = branch.commit.commit.tree.sha;

    const tree = await github<{
      truncated: boolean;
      tree: Array<{
        path: string;
        sha: string;
        type: string;
        mode: string;
      }>;
    }>(`/git/trees/${encodeURIComponent(baseTree)}?recursive=1`);

    if (tree.truncated) {
      throw new Error(
        "Remote tree is truncated. Cannot safely verify changes.",
      );
    }

    const entries = new Map(
      tree.tree
        .filter((entry) => entry.type === "blob")
        .map((entry) => [entry.path, entry]),
    );

    const lowerRemote = new Set(
      tree.tree.map((entry) => entry.path.toLowerCase()),
    );

    const updates: Array<{
      path: string;
      mode: string;
      type: "blob";
      sha?: null;
      content?: string;
    }> = [];

    for (const path of changed) {
      const entry = entries.get(path);
      const before = original.get(path);
      const after = working.get(path);

      if (before === undefined && lowerRemote.has(path.toLowerCase())) {
        throw new Error(`File already exists on GitHub: ${path}`);
      }

      if (before !== undefined) {
        if (!entry || !["100644", "100755"].includes(entry.mode)) {
          throw new Error(
            `Original GitHub file changed or unsupported: ${path}`,
          );
        }

        const rawBytes = Buffer.from(before, "utf8");

        const blob = Buffer.concat([
          Buffer.from(`blob ${rawBytes.length}\0`),
          rawBytes,
        ]);

        const algorithm = entry.sha.length === 64 ? "sha256" : "sha1";

        const gitBlobSha = createHash(algorithm).update(blob).digest("hex");

        if (gitBlobSha !== entry.sha) {
          throw new Error(
            `Local snapshot differs from GitHub: ${path}. ` + "Reimport first.",
          );
        }
      }

      updates.push(
        after === undefined
          ? {
              path,
              mode: entry!.mode,
              type: "blob",
              sha: null,
            }
          : {
              path,
              mode: entry?.mode ?? "100644",
              type: "blob",
              content: after,
            },
      );
    }
    const newTree = await github<{ sha: string }>("/git/trees", "POST", {
      base_tree: baseTree,
      tree: updates,
    });

    const publication = await createOrReusePullRequest({
      github,
      key: cryptoKey(),
      actor: session.login,
      fullName: identity.fullName,
      baseBranch: branchName,
      baseSha,
      treeSha: newTree.sha,
      title: title.trim(),
      previousPRNumber: priorPR,
      changedPaths: changed,
    });

    return NextResponse.json(publication, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const recovery = error instanceof PublishRecoveryError ? error : null;

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Publishing failed.",
        ...(recovery
          ? {
              branch: recovery.branch,
              branchUrl: recovery.branchUrl,
              warning:
                "Review the linked branch and repository pull requests " +
                "before retrying.",
            }
          : {}),
      },
      {
        status:
          recovery?.status ??
          (error instanceof GitHubHTTPError && [401, 403].includes(error.status)
            ? error.status
            : 502),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

async function getReleaseGate(request: NextRequest) {
  const session = decrypt<Session>(request.cookies.get(SESSION)?.value);

  if (!session) {
    return NextResponse.json(
      { error: "Connect GitHub first." },
      { status: 401 },
    );
  }

  const fullName = request.nextUrl.searchParams.get("repo") ?? "";
  const numberText = request.nextUrl.searchParams.get("number") ?? "";

  if (
    !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(fullName) ||
    !/^[1-9][0-9]{0,8}$/.test(numberText)
  ) {
    return NextResponse.json(
      { error: "Invalid PR reference." },
      { status: 400 },
    );
  }

  const [owner, repo] = fullName.split("/");
  const number = Number(numberText);

  const base =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function read<T>(path: string): Promise<T> {
    const response = await fetch(base + path, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  type PR = {
    state: "open" | "closed";
    draft: boolean;
    merged: boolean;
    mergeable: boolean | null;
    head: { sha: string };
  };

  type CheckResponse = {
    total_count: number;
    check_runs: Array<{
      name: string;
      status: string;
      conclusion: string | null;
      html_url?: string;
    }>;
  };

  type StatusResponse = {
    total_count?: number;
    statuses: Array<{
      context: string;
      state: string;
      target_url?: string;
    }>;
  };

  type Review = {
    user?: { login?: string };
    state: string;
  };

  let pr: PR;

  try {
    pr = await read<PR>(`/pulls/${number}`);

    if (!/^[a-f0-9]{40,64}$/i.test(pr.head.sha)) {
      throw new Error("Invalid PR head SHA");
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "Cannot read this Pull Request. " + "Check your GitHub connection.",
      },
      { status: 502 },
    );
  }

  const sha = encodeURIComponent(pr.head.sha);

  const [checksResult, statusResult, reviewsResult] = await Promise.allSettled([
    read<CheckResponse>(
      `/commits/${sha}/check-runs?per_page=100&filter=latest`,
    ),
    read<StatusResponse>(`/commits/${sha}/status?per_page=100`),
    read<Review[]>(`/pulls/${number}/reviews?per_page=100`),
  ]);

  const unavailable: string[] = [];

  const checks =
    checksResult.status === "fulfilled" ? checksResult.value : null;

  const statuses =
    statusResult.status === "fulfilled" ? statusResult.value : null;

  const reviews =
    reviewsResult.status === "fulfilled" ? reviewsResult.value : null;

  if (!checks) {
    unavailable.push("Check runs unavailable (check Checks permission).");
  }

  if (!statuses) {
    unavailable.push(
      "Commit statuses unavailable " + "(check Commit statuses permission).",
    );
  }

  if (!reviews) {
    unavailable.push(
      "PR reviews unavailable " + "(check Pull requests permission).",
    );
  }

  // Keep the last decisive review for each reviewer.
  const decisions = new Map<string, string>();

  for (const review of reviews ?? []) {
    const login = review.user?.login?.toLowerCase();

    if (
      login &&
      ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state)
    ) {
      decisions.set(login, review.state);
    }
  }

  const approvals = [...decisions.values()].filter(
    (value) => value === "APPROVED",
  ).length;

  const changeRequests = [...decisions.values()].filter(
    (value) => value === "CHANGES_REQUESTED",
  ).length;

  const checkRuns = (checks?.check_runs ?? []).map((check) => ({
    name: check.name,
    status: check.status,
    conclusion: check.conclusion,
    url: check.html_url?.startsWith("https://github.com/")
      ? check.html_url
      : null,
  }));

  const latestStatuses = new Map<string, StatusResponse["statuses"][number]>();

  for (const item of statuses?.statuses ?? []) {
    if (!latestStatuses.has(item.context)) {
      latestStatuses.set(item.context, item);
    }
  }

  const contexts = [...latestStatuses.values()].map((item) => ({
    name: item.context,
    state: item.state,
    url: item.target_url?.startsWith("https://") ? item.target_url : null,
  }));

  const truncated =
    (checks !== null && checks.total_count > checkRuns.length) ||
    (statuses !== null &&
      typeof statuses.total_count === "number" &&
      statuses.total_count > (statuses.statuses?.length ?? 0)) ||
    (reviews !== null && reviews.length >= 100);

  const failedChecks = checkRuns.some((check) =>
    [
      "failure",
      "timed_out",
      "cancelled",
      "action_required",
      "startup_failure",
    ].includes(check.conclusion ?? ""),
  );

  const failedStatuses = contexts.some((status) =>
    ["failure", "error"].includes(status.state),
  );

  const pendingChecks = checkRuns.some((check) => check.status !== "completed");

  const pendingStatuses = contexts.some((status) => status.state === "pending");

  const unconfirmedChecks = checkRuns.some(
    (check) => check.status === "completed" && check.conclusion !== "success",
  );

  const noCI = checkRuns.length + contexts.length === 0;

  let verdict:
    | "blocked"
    | "in-progress"
    | "not-verified"
    | "checks-passing"
    | "merged"
    | "closed";

  if (pr.merged) {
    verdict = "merged";
  } else if (pr.state === "closed") {
    verdict = "closed";
  } else if (
    failedChecks ||
    failedStatuses ||
    changeRequests > 0 ||
    pr.mergeable === false
  ) {
    verdict = "blocked";
  } else if (unavailable.length > 0 || truncated || noCI || unconfirmedChecks) {
    verdict = "not-verified";
  } else if (
    pr.draft ||
    pr.mergeable === null ||
    pendingChecks ||
    pendingStatuses
  ) {
    verdict = "in-progress";
  } else {
    verdict = "checks-passing";
  }

  return NextResponse.json(
    {
      verdict,
      headSha: pr.head.sha,
      checks: checkRuns,
      statuses: contexts,
      approvals,
      changeRequests,
      unavailable,
      truncated,
      note:
        "Required checks, branch rules, reviewer eligibility " +
        "and tests outside GitHub are not verified.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function getPullRequestStatus(request: NextRequest) {
  const session = decrypt<Session>(request.cookies.get(SESSION)?.value);

  if (!session) {
    return NextResponse.json(
      { error: "Connect GitHub to view Pull Request status." },
      { status: 401 },
    );
  }

  const fullName = request.nextUrl.searchParams.get("repo");
  const numberText = request.nextUrl.searchParams.get("number");

  if (
    !fullName ||
    !/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(fullName) ||
    !numberText ||
    !/^[1-9][0-9]{0,8}$/.test(numberText)
  ) {
    return NextResponse.json(
      { error: "Invalid repository or Pull Request number." },
      { status: 400 },
    );
  }

  const [owner, repo] = fullName.split("/");
  const number = Number(numberText);

  const apiUrl =
    `https://api.github.com/repos/` +
    `${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/pulls/${number}`;

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${session.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (response.status === 401) {
      return NextResponse.json(
        { error: "GitHub session expired. Reconnect." },
        { status: 401 },
      );
    }

    if (response.status === 403) {
      return NextResponse.json(
        { error: "GitHub denied access to this repository." },
        { status: 403 },
      );
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Pull Request not found or not accessible." },
        { status: 404 },
      );
    }

    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }

    const pr = (await response.json()) as {
      number: number;
      title: string;
      html_url: string;
      state: "open" | "closed";
      draft: boolean;
      merged: boolean;
      mergeable: boolean | null;
      updated_at: string;
      head: { sha: string };
      base: { ref: string };
    };

    return NextResponse.json(
      {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        state: pr.state,
        draft: pr.draft,
        merged: pr.merged,
        mergeable: pr.mergeable,
        updatedAt: pr.updated_at,
        headSha: pr.head.sha,
        baseBranch: pr.base.ref,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not retrieve Pull Request status." },
      { status: 502 },
    );
  }
}

async function status(request: NextRequest) {
  const configured = Boolean(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.GITHUB_COOKIE_KEY &&
    process.env.FORGEX_APP_ORIGIN,
  );

  const session = decrypt<Session>(request.cookies.get(SESSION)?.value);

  if (!session) {
    return NextResponse.json(
      { connected: false, configured },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${session.token}`,
      },
    });

    if (response.status === 401) {
      const expired = NextResponse.json({
        connected: false,
        configured,
      });

      expired.cookies.delete(SESSION);
      return expired;
    }

    if (!response.ok) {
      throw new Error("GitHub unavailable");
    }

    const user = (await response.json()) as {
      login?: string;
      name?: string | null;
      avatar_url?: string;
    };

    return NextResponse.json(
      {
        connected: true,
        login: user.login ?? session.login,
        name: user.name ?? null,
        avatarUrl: user.avatar_url ?? null,
        configured,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "GitHub status unavailable" },
      { status: 503 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;

  if (action === "connect") return connect();
  if (action === "callback") return callback(request);
  if (action === "session") return status(request);
  if (action === "pr-status") return getPullRequestStatus(request);
  if (action === "release-gate") return getReleaseGate(request);
  if (action === "repositories") return repositories(request);
  return NextResponse.json({ error: "Unknown action" }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (action === "publish") {
    return publishPullRequest(request);
  }
  if (action === "private-import") {
    return importPrivateRepository(request);
  }
  if (action !== "session") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = request.headers.get("origin");

  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const response = NextResponse.json({
    connected: false,
  });

  response.cookies.delete(SESSION);
  response.headers.set("Cache-Control", "no-store");

  return response;
}
