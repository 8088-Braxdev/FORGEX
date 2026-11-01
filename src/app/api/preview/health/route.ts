
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  let payload: unknown;

  try {
    const raw = await request.text();

    if (raw.length > 1024) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 }
      );
    }

    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request." },
      { status: 400 }
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("message" in payload) ||
    typeof payload.message !== "string" ||
    !payload.message.trim() ||
    payload.message.length > 160
  ) {
    return NextResponse.json(
      { error: "A valid message is required." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      service: "FORGEX Preview API",
      message: payload.message.trim(),
      receivedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
