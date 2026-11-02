import { safeIdePath } from "./paths";

export type PreviewBinaryAsset = {
  path: string;
  dataUrl: string;
};

export const MAX_PREVIEW_IMAGE_BYTES = 1_500_000;
export const MAX_PREVIEW_IMAGE_TOTAL_BYTES = 8_000_000;
export const MAX_PREVIEW_IMAGES = 32;

const imageTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
};

export async function readPreviewBinaryAsset(
  file: File,
  path: string,
): Promise<PreviewBinaryAsset | null> {
  if (!safeIdePath(path) || safeIdePath(path) !== path) return null;
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = imageTypes[extension];

  if (
    !mime ||
    file.size === 0 ||
    file.size > MAX_PREVIEW_IMAGE_BYTES
  ) {
    return null;
  }

  const bytes = new Uint8Array(
    await file.slice(0, 16).arrayBuffer(),
  );

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  const isValid =
    extension === "png"
      ? bytes.length >= 8 &&
        [137, 80, 78, 71, 13, 10, 26, 10].every(
          (value, index) => bytes[index] === value,
        )
      : extension === "jpg" || extension === "jpeg"
        ? bytes.length >= 3 &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255
        : extension === "gif"
          ? ["GIF87a", "GIF89a"].includes(ascii(0, 6))
          : extension === "webp"
            ? ascii(0, 4) === "RIFF" &&
              ascii(8, 12) === "WEBP"
            : extension === "ico"
              ? bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0
              : false;

  if (!isValid) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result =
        typeof reader.result === "string"
          ? reader.result
          : "";

      const comma = result.indexOf(",");

      if (comma === -1 || !result.includes(";base64,")) {
        resolve(null);
        return;
      }

      const encoded = result.slice(comma + 1);

      resolve({
        path,
        dataUrl: `data:${mime};base64,${encoded}`,
      });
    };

    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);

    reader.readAsDataURL(file);
  });
}

export function imageMime(path: string): string | null {
  return imageTypes[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export function validatePreviewAssets(value: unknown, textPaths: readonly string[] = []): PreviewBinaryAsset[] {
  if (!Array.isArray(value) || value.length > MAX_PREVIEW_IMAGES) throw new Error("Too many workspace images.");
  const seen = new Set(textPaths.map(path => path.toLowerCase()));
  let total = 0;
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || !("path" in raw) || !("dataUrl" in raw) || typeof raw.path !== "string" || typeof raw.dataUrl !== "string") throw new Error("Invalid workspace image.");
    const path = safeIdePath(raw.path);
    const mime = path ? imageMime(path) : null;
    if (!path || !mime || seen.has(path.toLowerCase())) throw new Error("Invalid or duplicate image path.");
    const prefix = `data:${mime};base64,`;
    const encoded = raw.dataUrl.slice(prefix.length);
    if (!raw.dataUrl.startsWith(prefix) || encoded.length > Math.ceil(MAX_PREVIEW_IMAGE_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error("Invalid image encoding or size.");
    let decoded: string;
    try { decoded = atob(encoded); } catch { throw new Error("Invalid image encoding."); }
    const bytes = Uint8Array.from(decoded.slice(0, 16), c => c.charCodeAt(0));
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
    const valid = mime === "image/png" ? [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)
      : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/gif" ? ["GIF87a", "GIF89a"].includes(ascii(0, 6))
      : mime === "image/webp" ? ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP"
      : bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0;
    total += decoded.length;
    if (!valid || !decoded.length || decoded.length > MAX_PREVIEW_IMAGE_BYTES || total > MAX_PREVIEW_IMAGE_TOTAL_BYTES) throw new Error("Invalid image signature or workspace image limit exceeded.");
    seen.add(path.toLowerCase());
    return { path, dataUrl: raw.dataUrl };
  });
}

// SVGs stay editable text; only a conservative subset is shown as an image.
export function svgPreviewUrl(content: string): string | null {
  if (content.length > 100_000 || !/<svg(?:\s|>)/i.test(content) || /<!DOCTYPE|<!ENTITY|<(?:[a-z][a-z0-9_-]*:)?(?:script|foreignObject|iframe|object|embed|animate|set)\b|@import|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:[a-z]+:|\/\/)|url\(\s*["']?\s*(?:[a-z]+:|\/\/)/i.test(content)) return null;
  try { return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(content); } catch { return null; }
}
