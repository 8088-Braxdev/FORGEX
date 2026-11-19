import { readSmallJson, RequestBodyError } from "@/lib/requestBody";
import { NextResponse } from "next/server";
import { importGitHubRepository, parseRepository, GitHubImportError } from "@/lib/githubImport";
import { clientKey, rateLimited } from "@/lib/rateLimit";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (rateLimited(`github:${clientKey(request)}`, 60)) {
    return NextResponse.json({ error: "Too many GitHub requests. Wait a moment and try again." }, { status: 429 });
  }
  let url: string;
  try {
    const body = await readSmallJson(request);
    if (!body || typeof body !== 'object' || !('url' in body) || typeof body.url !== 'string' || body.url.length > 300) throw new Error("Enter a GitHub repository URL.");
    url = body.url.trim(); parseRepository(url);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid repository URL." }, { status: error instanceof RequestBodyError ? error.status : 400 }); }
  try { return NextResponse.json(await importGitHubRepository(url), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Repository import failed." }, { status: error instanceof GitHubImportError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } }); }
}
