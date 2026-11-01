"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";

export function estimateImageBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const encoded = dataUrl.slice(comma + 1);
  if (!encoded) return 0;
  // Base64: 4 chars -> 3 bytes, minus padding.
  let padding = 0;
  if (encoded.endsWith("==")) padding = 2;
  else if (encoded.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

export type ImageViewerAsset = {
  path: string;
  dataUrl: string;
};

export default function ImageViewer({
  asset,
  onClose,
}: {
  asset: ImageViewerAsset | null;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [asset]);

  useEffect(() => {
    if (!asset) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asset, onClose]);

  if (!asset) return null;

  const extension = asset.path.split(".").pop()?.toLowerCase() ?? "";
  const estimatedBytes = Math.round(
    ((asset.dataUrl.split(",")[1]?.length ?? 0) * 3) / 4,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer: ${asset.path}`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#101920",
          border: "1px solid #30464f",
          borderRadius: 10,
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid #30464f",
            gap: 12,
          }}
        >
          <strong style={{ fontSize: 13, color: "#e7f3f0" }}>
            {asset.path}
          </strong>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))}
              style={buttonStyle}
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setZoom((value) => Math.min(4, value + 0.25))}
              style={buttonStyle}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              aria-label="Close image viewer"
              onClick={onClose}
              style={buttonStyle}
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0d141a",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.dataUrl}
            alt={asset.path}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          />
        </div>

        <footer
          style={{
            padding: "8px 12px",
            borderTop: "1px solid #30464f",
            fontSize: 11,
            color: "#aebfc6",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>Format: {extension.toUpperCase() || "unknown"}</span>
          <span>Approx. size: {estimatedBytes.toLocaleString()} bytes</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </footer>
      </div>
    </div>
  );
}

const buttonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  border: "1px solid #30464f",
  borderRadius: 6,
  background: "#1a2a33",
  color: "#e7f3f0",
  cursor: "pointer",
} as const;