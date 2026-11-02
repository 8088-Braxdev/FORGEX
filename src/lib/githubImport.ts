import type { SourceFile } from "./analyzer";
import { safeIdePath } from "./paths";
import { imageMime, validatePreviewAssets, MAX_PREVIEW_IMAGES, MAX_PREVIEW_IMAGE_BYTES, MAX_PREVIEW_IMAGE_TOTAL_BYTES, type PreviewBinaryAsset } from "./previewAssets";

export const GITHUB_TEXT_PATH = /\.(js|jsx|mjs|cjs|ts|tsx|py|json|css|scss|html|htm|md|txt|svg|yml|yaml|xml|go|rs|java|c|h|cpp|hpp|cs|php|sql|sh)$/i;
const IGNORE = /(^|\/)(node_modules|\.git|\.next|dist|build|coverage|vendor)(\/|$)|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$|\.min\.(js|css)$|\.snap$/i;
export function parseRepository(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Enter a valid GitHub repository URL."); }
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.origin !== "https://github.com" || url.username || url.password || url.search || url.hash || parts.length !== 2) throw new Error("Use https://github.com/owner/repo. File and branch URLs are not supported.");
  const [owner, rawRepo] = parts;
  const repo = rawRepo.replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || repo.startsWith('.')) throw new Error("Invalid GitHub repository name.");
  return { owner, repo };
}

export class GitHubImportError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

type TreeEntry = { path: string; type: string; mode?: string; size?: number; sha?: string };
const SHA = /^[a-f0-9]{40,64}$/i;
export const MAX_GITHUB_IMPORT_RESPONSE_BYTES = 4_000_000;

/** Read a single immutable commit. Only fixed GitHub API endpoints receive credentials. */
export async function importGitHubRepository(input: string, token?: string) {
  const deadline = Date.now() + 40_000;
  const { owner, repo } = parseRepository(input);
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  async function read<T>(suffix: string): Promise<T> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("GitHub import time limit reached.");
    const response = await fetch(base + suffix, {
      method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(Math.min(15000, remaining)),
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) throw new GitHubImportError(response.status === 401 ? "GitHub session expired. Reconnect your account." : response.status === 403 || response.status === 429 ? "GitHub access or rate limit reached. Check access and try again later." : response.status === 404 ? "Repository or Git data is not accessible to FORGEX." : `GitHub request failed (HTTP ${response.status}).`, response.status);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("GitHub returned no response body.");
    const decoder = new TextDecoder(); let text = ''; let bytes = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 8_500_000) { await reader.cancel(); throw new Error("GitHub response exceeds the import limit."); }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    return JSON.parse(text) as T;
  }
  const info = await read<{ default_branch?: string; private?: boolean }>('');
  if (!info.default_branch || (!token && info.private)) throw new Error("Connect GitHub to import this repository.");
  const branch = await read<{ commit?: { sha?: string; commit?: { tree?: { sha?: string } } } }>(`/branches/${encodeURIComponent(info.default_branch)}`);
  const commitSha = branch.commit?.sha; const treeSha = branch.commit?.commit?.tree?.sha;
  if (!commitSha || !treeSha || !SHA.test(commitSha) || !SHA.test(treeSha)) throw new Error("Cannot identify repository commit and tree.");
  const tree = await read<{ tree?: TreeEntry[]; truncated?: boolean }>(`/git/trees/${treeSha}?recursive=1`);
  if (!Array.isArray(tree.tree)) throw new Error("GitHub returned no file tree.");
  const relevant = tree.tree.filter(entry => entry.type === 'blob' && typeof entry.path === 'string' && !IGNORE.test(entry.path) && !entry.path.split('/').some(part => part.toLowerCase().startsWith('.env')) && (GITHUB_TEXT_PATH.test(entry.path) || imageMime(entry.path)));
  let sourceCandidates = 0; let imageCandidates = 0;
  const selected = relevant.filter(entry => {
    if (entry.mode === '120000' || safeIdePath(entry.path) !== entry.path || entry.path.length > 500) return false;
    return imageMime(entry.path) ? imageCandidates++ < MAX_PREVIEW_IMAGES : sourceCandidates++ < 60;
  });
  const files: SourceFile[] = []; const assets: PreviewBinaryAsset[] = [];
  const seen = new Set<string>(); let skipped = relevant.length - selected.length; let chars = 0; let imageBytes = 0;
  let responseBytes = 4096; // Reserve metadata overhead below the hosting response limit.
  for (let index = 0; index < selected.length; index += 4) {
    if (Date.now() >= deadline) { skipped += selected.length - index; break; }
    const candidates = selected.slice(index, index + 4);
    const batch = await Promise.all(candidates.map(async entry => {
      const mime = imageMime(entry.path);
      const tooMany = mime ? assets.length >= MAX_PREVIEW_IMAGES : files.length >= 60;
      if (tooMany || typeof entry.size !== 'number' || entry.size < 0 || entry.size > (mime ? MAX_PREVIEW_IMAGE_BYTES : 125_000) || !entry.sha || !SHA.test(entry.sha)) return null;
      try {
        const blob = await read<{ encoding?: string; content?: string }>(`/git/blobs/${entry.sha}`);
        if (blob.encoding !== 'base64' || typeof blob.content !== 'string') return null;
        const encoded = blob.content.replace(/\s/g, '');
        if (encoded.length > Math.ceil((mime ? MAX_PREVIEW_IMAGE_BYTES : 125_000) / 3) * 4) return null;
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.length !== entry.size) return null;
        if (mime) return { kind: 'image' as const, asset: validatePreviewAssets([{ path: entry.path, dataUrl: `data:${mime};base64,${encoded}` }])[0], bytes: bytes.length };
        const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
        if (content.includes('\0')) return null;
        return { kind: 'text' as const, file: { path: entry.path, content } };
      } catch { return null; }
    }));
    for (const item of batch) {
      const path = item?.kind === 'image' ? item.asset.path : item?.file.path;
      if (!item || !path || seen.has(path.toLowerCase())) { skipped++; continue; }
      const encodedBytes = Buffer.byteLength(JSON.stringify(item.kind === 'image' ? item.asset : item.file), 'utf8') + 1;
      if (responseBytes + encodedBytes > MAX_GITHUB_IMPORT_RESPONSE_BYTES) { skipped++; continue; }
      if (item.kind === 'image') {
        if (assets.length >= MAX_PREVIEW_IMAGES || imageBytes + item.bytes > MAX_PREVIEW_IMAGE_TOTAL_BYTES) { skipped++; continue; }
        assets.push(item.asset); imageBytes += item.bytes;
      } else {
        if (files.length >= 60 || chars + item.file.content.length > 2_000_000) { skipped++; continue; }
        files.push(item.file); chars += item.file.content.length;
      }
      responseBytes += encodedBytes;
      seen.add(path.toLowerCase());
    }
  }
  if (!files.length && !assets.length) throw new Error("No supported files were imported.");
  return { repository: `${owner}/${repo}`, branch: info.default_branch, commitSha, files, assets, skipped, partial: !!tree.truncated || skipped > 0 };
}
