import { NextResponse } from "next/server";

// Preserve installed clients that still request the old icon URL.
export async function GET(request: Request) {
  const size = new URL(request.url).searchParams.get("size");
  if (size !== "192" && size !== "512") {
    return new Response("Unsupported icon size.", { status: 404 });
  }
  return NextResponse.redirect(new URL(`/brand/icon-${size}.png`, request.url), 307);
}
