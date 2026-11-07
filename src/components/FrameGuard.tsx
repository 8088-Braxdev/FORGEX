"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function FrameGuard({ children }: { children: ReactNode }) {
  const [inFrame, setInFrame] = useState(false);

  useEffect(() => {
    try {
      if (window.self !== window.top) setInFrame(true);
    } catch {
      setInFrame(true);
    }
  }, []);

  if (inFrame) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#e9f4f0",
          background: "#101820",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p>This page can't be shown inside the preview</p>
      </main>
    );
  }

  return <>{children}</>;
}