import { NextResponse } from "next/server";
import type { SourceFile } from "@/lib/analyzer";

export const runtime = "nodejs";

const MAX_FILES = 60;
const MAX_FILE_BYTES = 125_000;
const MAX_TOTAL_CHARS = 2_000_000;

const SOURCE = /\.(js|jsx|mjs|cjs|ts|tsx|py|json|css|html|htm|md)$/i;

const IGNORE =
  /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|vendor)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\.(js|css)$|\.snap$/i;

type TreeItem = {
  path: string;
  type: string;
  size?: number;
};

type TreeResponse = {
  tree?: TreeItem[];
  truncated?: boolean;
};

type RepoResponse = {
  default_branch?: string;
  private?: boolean;
};

function parseRepository(input: string) {
let url: URL;

try {
  url = new URL(input);
} catch {
  throw new Error("Enter a valid GitHub repository URL.");
}

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length !== 2) {
    throw new Error(
      "Enter a repository URL only. File and branch URLs are not supported. file au branch link.",
    );
  }

  const [owner, rawRepo] = parts;
  const repo = rawRepo.replace(/\.git$/i, "");

  if (
    !/^[\w-]{1,39}$/.test(owner) ||
    !/^[\w.-]{1,100}$/.test(repo) ||
    repo.startsWith(".")
  ) {
    throw new Error("Invalid GitHub repository name.");
  }

  return { owner, repo };
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 404) {
    throw new Error("Invalid GitHub repository name.");
  }

  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub rate limit reached. Please try again later.");
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed (HTTP ${response.status}).`);
  }

  return response.json() as Promise<T>;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("url" in body) ||
      typeof body.url !== "string" ||
      body.url.length > 250
    ) {
      return NextResponse.json(
        { error: "Weka GitHub repository link." },
        { status: 400 },
      );
    }

    const { owner, repo } = parseRepository(body.url.trim());
    const base = `https://api.github.com/repos/${owner}/${repo}`;

    const info = await githubJson<RepoResponse>(base);

    if (info.private || !info.default_branch) {
      throw new Error("A public repository with a default branch is required.");
    }

    const tree = await githubJson<TreeResponse>(
      `${base}/git/trees/${encodeURIComponent(info.default_branch)}?recursive=1`,
    );

    if (!Array.isArray(tree.tree)) {
      throw new Error("GitHub did not return a file tree.");
    }

    const eligible = tree.tree.filter(
      (file) =>
        file.type === "blob" &&
        typeof file.path === "string" &&
        typeof file.size === "number" &&
        file.size > 0 &&
        file.size <= MAX_FILE_BYTES &&
        SOURCE.test(file.path) &&
        !IGNORE.test(file.path) &&
        !file.path.split("/").some((segment) => segment.startsWith(".env")),
    );

    const selected = eligible.slice(0, MAX_FILES);
    const files: SourceFile[] = [];

    let skipped = eligible.length - selected.length;
    let totalChars = 0;

    for (let i = 0; i < selected.length; i += 4) {
      const batch = await Promise.all(
        selected.slice(i, i + 4).map(async (file) => {
          try {
            const encodedPath = file.path
              .split("/")
              .map(encodeURIComponent)
              .join("/");

            const rawUrl =
              `https://raw.githubusercontent.com/${owner}/${repo}/` +
              `${encodeURIComponent(info.default_branch!)}/${encodedPath}`;

            const response = await fetch(rawUrl, {
              cache: "no-store",
              signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) return null;

            const content = await response.text();

            if (content.length > MAX_FILE_BYTES || content.includes("\0")) {
              return null;
            }

            return {
              path: file.path,
              content,
            } satisfies SourceFile;
          } catch {
            return null;
          }
        }),
      );

      for (const file of batch) {
        if (!file || totalChars + file.content.length > MAX_TOTAL_CHARS) {
          skipped++;
          continue;
        }

        totalChars += file.content.length;
        files.push(file);
      }

      if (totalChars >= MAX_TOTAL_CHARS) {
        skipped += selected.length - (i + 4);
        break;
      }
    }

    if (!files.length) {
      throw new Error(
        "No supported source files could be imported from this repository.",
      );
    }

    return NextResponse.json(
      {
        repository: `${owner}/${repo}`,
        branch: info.default_branch,
        files,
        skipped,
        partial: !!tree.truncated || skipped > 0,
        scannedAt: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Repo import failed.";


const invalidInput =
  message === "Enter a valid GitHub repository URL." ||
  message === "Enter a repository URL only. File and branch URLs are not supported." ||
  message === "Invalid GitHub repository name.";


    return NextResponse.json(
      { error: message },
      { status: invalidInput ? 400 : 502 },
    );
  }
}
