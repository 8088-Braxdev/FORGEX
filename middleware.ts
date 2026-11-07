import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FRAMED_MESSAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>This page can't be shown inside the preview</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#101820;color:#e9f4f0;font-family:system-ui,sans-serif;">
  <p>This page can't be shown inside the preview</p>
</body>
</html>`;

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/monaco/") ||
    pathname.startsWith("/brand/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:woff2?|ttf|otf|eot|png|jpg|jpeg|webp|gif|ico|svg|css|js)$/i.test(
      pathname,
    )
  );
}

export function middleware(request: NextRequest) {
  const destination = request.headers.get("sec-fetch-dest");
  if (destination !== "iframe") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();
  if (isStaticAsset(pathname)) return NextResponse.next();

  return new NextResponse(FRAMED_MESSAGE, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};