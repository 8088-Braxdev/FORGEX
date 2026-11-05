import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Forwarded request headers the proxy allows from a preview.
 * Provider auth headers are included so real AI/API calls work through
 * the proxy when the browser blocks the direct request (sandboxed
 * origins send Origin: null): Google uses x-goog-api-key (Gemini) and
 * x-goog-user-project, Anthropic uses x-api-key, and standard clients
 * use authorization.
 */
const ALLOWED_REQUEST_HEADERS = new Set([
  "content-type",
  "accept",
  "authorization",
  "x-goog-api-key",
  "x-goog-user-project",
  "x-api-key",
]);

const MAX_REQUEST_BYTES = 100 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

type ClientRate = { count: number; startedAt: number };
const rateBuckets = new Map<string, ClientRate>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, startedAt: now });
    if (rateBuckets.size > 5000) {
      // Opportunistic cleanup for long-lived instances.
      for (const [bucketKey, value] of rateBuckets) {
        if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) {
          rateBuckets.delete(bucketKey);
        }
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return true;
  const [a, b] = octets;
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0 || a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

/**
 * SSRF guard: only public HTTPS hosts reachable through the proxy.
 * Plain module-local function: Next.js route files may only export route
 * handlers and route segment config.
 */
function isProxyTargetAllowed(rawTarget: string): { allowed: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawTarget);
  } catch {
    return { allowed: false, reason: "Target is not a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { allowed: false, reason: "Only https targets are supported." };
  }
  if (url.username || url.password) {
    return { allowed: false, reason: "Credentials in the target URL are not supported." };
  }

  const host = url.hostname.toLowerCase();
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return { allowed: false, reason: "Local hostnames are not allowed." };
  }
  if (
    typeof process !== "undefined" &&
    process.env.VERCEL_URL &&
    host === process.env.VERCEL_URL.toLowerCase()
  ) {
    return { allowed: false, reason: "The FORGEX origin is not allowed." };
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { allowed: false, reason: "Private network addresses are not allowed." };
  }
  return { allowed: true };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Goog-Api-Key, X-Goog-User-Project, X-Api-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const originHeader = request.headers.get("origin");
  if (originHeader && originHeader !== "null") {
    return NextResponse.json(
      { error: "This endpoint is reserved for the FORGEX preview sandbox." },
      { status: 403, headers: corsHeaders() },
    );
  }

  const key = clientKey(request);
  if (rateLimited(key)) {
    return NextResponse.json(
      { error: "Too many preview API requests. Wait a moment and try again." },
      { status: 429, headers: corsHeaders() },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "JSON is required." },
      { status: 415, headers: corsHeaders() },
    );
  }

  let payload: {
    target?: unknown;
    method?: unknown;
    headers?: unknown;
    body?: unknown;
  };
  try {
    const raw = await request.text();
    if (raw.length > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413, headers: corsHeaders() },
      );
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400, headers: corsHeaders() },
    );
  }

  if (typeof payload.target !== "string" || !payload.target.trim()) {
    return NextResponse.json(
      { error: "A target URL is required." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const target = payload.target.trim();
  if (target.length > 2048) {
    return NextResponse.json(
      { error: "Target URL is too long." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const check = isProxyTargetAllowed(target);
  if (!check.allowed) {
    return NextResponse.json(
      { error: check.reason ?? "Target is not allowed." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const method = typeof payload.method === "string"
    ? payload.method.toUpperCase()
    : "GET";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) {
    return NextResponse.json(
      { error: "Unsupported method." },
      { status: 400, headers: corsHeaders() },
    );
  }

  const forwardedHeaders = new Headers();
  if (payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers)) {
    for (const [name, value] of Object.entries(payload.headers as Record<string, unknown>)) {
      if (!ALLOWED_REQUEST_HEADERS.has(name.toLowerCase())) continue;
      if (typeof value !== "string") continue;
      forwardedHeaders.set(name, value);
    }
  }

  let body: string | undefined;
  if (
    payload.body !== undefined &&
    payload.body !== null &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    if (typeof payload.body !== "string") {
      return NextResponse.json(
        { error: "Body must be a string." },
        { status: 400, headers: corsHeaders() },
      );
    }
    if (payload.body.length > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "Body too large." },
        { status: 413, headers: corsHeaders() },
      );
    }
    body = payload.body;
    if (!forwardedHeaders.has("content-type")) {
      forwardedHeaders.set("content-type", "application/json");
    }
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method,
      headers: forwardedHeaders,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // Some providers issue a same-host http->https or path redirect on
    // their API endpoints. Follow one https redirect so proxied AI calls
    // do not surface an opaque 30x as the final response.
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      const redirectTarget = response.headers.get("location") ?? "";
      const absolute = new URL(redirectTarget, target).toString();
      if (isProxyTargetAllowed(absolute).allowed) {
        response = await fetch(absolute, {
          method,
          headers: forwardedHeaders,
          body,
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      }
    }
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      {
        error: timedOut
          ? "The target API did not respond in time."
          : "The request to the target API failed.",
      },
      { status: 502, headers: corsHeaders() },
    );
  }

  const responseContentType = response.headers.get("content-type") ?? "text/plain";

  let responseBody: string;
  try {
    const raw = await response.text();
    responseBody = raw.length > MAX_RESPONSE_BYTES
      ? raw.slice(0, MAX_RESPONSE_BYTES)
      : raw;
  } catch {
    responseBody = "";
  }

  return NextResponse.json(
    {
      status: response.status,
      contentType: responseContentType,
      body: responseBody,
    },
    {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store",
      },
    },
  );
}