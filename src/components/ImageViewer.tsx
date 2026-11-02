"use client";

import { useState } from "react";
import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { PreviewBinaryAsset } from "@/lib/previewAssets";
import styles from "./ImageViewer.module.css";

export default function ImageViewer({ asset, onViewSource }: { asset: PreviewBinaryAsset; onViewSource?: () => void }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [loadedImage, setLoadedImage] = useState<{ width: number; height: number; source: string } | null>(null);
  const [failedUrl, setFailedUrl] = useState("");
  const dimensions = loadedImage?.source === asset.dataUrl ? loadedImage : null;
  const failed = failedUrl === asset.dataUrl;
  const base64 = asset.dataUrl.includes(';base64,');
  const payload = asset.dataUrl.slice(asset.dataUrl.indexOf(',') + 1);
  const bytes = base64 ? Math.floor(payload.length * 3 / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0) : new TextEncoder().encode(decodeURIComponent(payload)).length;
  const format = asset.path.split('.').pop()?.toUpperCase() ?? 'Image';
  return (
    <section className={styles.viewer} aria-label={`Image viewer: ${asset.path}`}>
      <header className={styles.toolbar}>
        <span className={styles.path} title={asset.path}>{asset.path}</span>
        <div className={styles.controls}>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom(n => Math.max(.25, (n ?? 1) - .25))}><ZoomOut size={16} /></button>
          <span>{zoom === null ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom(n => Math.min(4, (n ?? 1) + .25))}><ZoomIn size={16} /></button>
          <button type="button" aria-label="Fit image" onClick={() => setZoom(null)}><Maximize2 size={16} /></button>
          <a href={asset.dataUrl} download={asset.path.split('/').pop()} aria-label="Download image"><Download size={16} /></a>
          {onViewSource ? <button type="button" onClick={onViewSource}>View source</button> : null}
        </div>
      </header>
      <div className={`${styles.canvas} ${zoom === null ? styles.fit : ''}`}>
        {failed ? <p role="status">This image could not be decoded. The original file is preserved in your workspace.</p> : (
          <img src={asset.dataUrl} alt={asset.path} onError={() => setFailedUrl(asset.dataUrl)} onLoad={event => setLoadedImage({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight, source: asset.dataUrl })} style={zoom !== null && dimensions ? { width: dimensions.width * zoom, maxWidth: 'none', maxHeight: 'none' } : undefined} />
        )}
      </div>
      <footer>{format} · {bytes.toLocaleString()} bytes {dimensions ? `· ${dimensions.width} × ${dimensions.height} px` : ''}</footer>
    </section>
  );
}
