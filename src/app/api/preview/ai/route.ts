
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "gemini-3.5-flash-lite";

// In-memory rate limit (per server instance). Not a substitute for
// production-grade quota controls; the route remains development-only.
const requestTimestamps = new Map<string, number[]>();

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (requestTimestamps.get(key) ?? []).filter(
    (value) => now - value < windowMs,
  );

  if (recent.length >= limit) {
    requestTimestamps.set(key, recent);
    return true;
  }

  recent.push(now);
  requestTimestamps.set(key, recent);
  return false;
}

// Development-only guard. Not a production rate limiter.
let lastRequestAt = 0;

type GeminiResult = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  const origin = request.headers.get("origin");

  if (
    origin &&
    origin !== new URL(request.url).origin
  ) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403 }
    );
  }

  if (rateLimited(clientKey(request), 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many preview requests. Try again later." },
      { status: 429 }
    );
  }

  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: "JSON is required." },
      { status: 415 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI provider is not configured." },
      { status: 503 }
    );
  }

  let payload: unknown;

  try {
    const raw = await request.text();

    if (raw.length > 1200) {
      return NextResponse.json(
        { error: "Request is too large." },
        { status: 413 }
      );
    }

    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON." },
      { status: 400 }
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("prompt" in payload) ||
    typeof payload.prompt !== "string" ||
    !payload.prompt.trim() ||
    payload.prompt.length > 500
  ) {
    return NextResponse.json(
      { error: "Prompt must be 1–500 characters." },
      { status: 400 }
    );
  }

  const now = Date.now();

  if (now - lastRequestAt < 5000) {
    return NextResponse.json(
      { error: "Wait before sending another request." },
      { status: 429 }
    );
  }

  lastRequestAt = now;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: payload.prompt.trim() }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 768,
          },
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!response.ok) {
      console.info("forgex preview ai provider rejected", {
        status: response.status,
      });
      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "AI provider quota exceeded."
              : "AI provider rejected the request.",
        },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const data = (await response.json()) as GeminiResult;

    const answer = (
      data.candidates?.[0]?.content?.parts ?? []
    )
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!answer) {
      return NextResponse.json(
        { error: "AI provider returned no text." },
        { status: 502 }
      );
    }

    console.info("forgex preview ai completed", { model: MODEL });
    return NextResponse.json(
      {
        ok: true,
        provider: "Gemini",
        model: MODEL,
        answer: answer.slice(0, 4000),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to reach AI provider." },
      { status: 502 }
    );
  }
}
