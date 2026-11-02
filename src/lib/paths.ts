export function safeIdePath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (!normalized || normalized.startsWith("/") || segments.length > 24)
    return null;
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[<>:"|?*\x00-\x1f]/.test(segment) ||
        segment.length > 120,
    )
  )
    return null;
  return normalized;
}

