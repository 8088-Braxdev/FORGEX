
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
};

export async function readPreviewBinaryAsset(
  file: File,
  path: string,
): Promise<PreviewBinaryAsset | null> {
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
