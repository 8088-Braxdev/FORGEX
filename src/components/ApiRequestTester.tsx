"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ApiRequestTester.module.css";

type Method = "GET" | "POST";

type ApiResult = {
  status: number;
  statusText: string;
  durationMs: number;
  contentType: string;
  body: string;
  truncated: boolean;
  viaProxy: boolean;
};

const MAX_RESPONSE_BYTES = 120_000;
const DIRECT_TIMEOUT_MS = 12_000;
const PROXY_TIMEOUT_MS = 20_000;

export default function ApiRequestTester({
  active,
}: {
  active: boolean;
}) {
  const [method, setMethod] = useState<Method>("GET");
  const [url, setUrl] = useState("/manifest.webmanifest");
  const [headersText, setHeadersText] = useState(
    '{"Accept": "application/json"}'
  );
  const [requestBody, setRequestBody] = useState("{\n  \n}");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");

  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) controllerRef.current?.abort();
  }, [active]);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  /**
   * Server-side fallback. A browser request to an API without CORS
   * headers fails with no useful diagnostics ("connection issue"); the
   * FORGEX preview proxy performs a real server-to-server request and
   * returns {status, contentType, body}. Only content-type, accept and
   * authorization headers are forwarded; cookies are never attached.
   */
  async function fetchViaProxy(
    target: URL,
    headers: Headers,
    bodyText: string | null,
    timeoutMs: number
  ): Promise<{ ok: boolean; status: number; statusText: string; contentType: string; body: string }> {
    const forwarded: Record<string, string> = {};
    headers.forEach((value, name) => {
      const lower = name.toLowerCase();
      if (lower === "content-type" || lower === "accept" || lower === "authorization") {
        forwarded[name] = value;
      }
    });

    const response = await fetch("/api/preview/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        target: target.toString(),
        method,
        headers: forwarded,
        body: bodyText ?? undefined,
      }),
    });

    if (!response.ok) {
      let message = "Proxy request failed.";
      try {
        const info: unknown = await response.json();
        if (
          info &&
          typeof info === "object" &&
          "error" in info &&
          typeof (info as { error: unknown }).error === "string"
        ) {
          message = (info as { error: string }).error;
        }
      } catch {
        // Keep the generic message.
      }
      return { ok: false, status: response.status, statusText: message, contentType: "application/json", body: "" };
    }

    const envelope: unknown = await response.json();
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !("status" in envelope) ||
      !("body" in envelope)
    ) {
      return { ok: false, status: 502, statusText: "Proxy returned an invalid envelope.", contentType: "application/json", body: "" };
    }

    const data = envelope as { status: number; contentType?: string; body?: string };

    return {
      ok: true,
      status: data.status,
      statusText: data.status >= 200 && data.status < 300 ? "OK" : "",
      contentType: data.contentType ?? "unknown",
      body: typeof data.body === "string" ? data.body : "",
    };
  }

  async function sendRequest() {
    if (busy) return;

    let target: URL;
    let headers: Headers;

    try {
      if (!url.trim() || url.length > 2048) {
        throw new Error("Enter a valid URL (maximum 2048 characters).");
      }

      target = new URL(url.trim(), window.location.origin);

      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password
      ) {
        throw new Error(
          "Only HTTP(S) URLs without embedded credentials are supported."
        );
      }

      const parsed: unknown = JSON.parse(headersText);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Request headers must be a JSON object.");
      }

      const entries = Object.entries(parsed);

      if (entries.length > 16) {
        throw new Error("Maximum 16 request headers.");
      }

      headers = new Headers();

      for (const [name, value] of entries) {
        if (
          typeof value !== "string" ||
          name.length > 100 ||
          value.length > 2000
        ) {
          throw new Error("Invalid header name or value.");
        }

        headers.set(name, value);
      }

      if (method === "POST" && requestBody.trim()) {
        if (requestBody.length > 20_000) {
          throw new Error("Request body exceeds 20,000 characters.");
        }

        JSON.parse(requestBody);

        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Invalid request configuration."
      );
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    setBusy(true);
    setError("");
    setResult(null);

    const started = performance.now();
    const bodyText =
      method === "POST" && requestBody.trim() ? requestBody : null;

    // Relative URLs stay on the FORGEX origin (same-origin, no proxy).
    // Absolute external URLs try the browser first; if CORS or the
    // network blocks the call, retry through the server proxy so the
    // tester still shows the real response.
    const isExternal = target.origin !== window.location.origin;

    const finishDirect = async (response: Response): Promise<ApiResult> => {
      let responseText = "";
      let truncated = false;

      const reader = response.body?.getReader();

      if (reader) {
        const decoder = new TextDecoder();
        let received = 0;

        while (true) {
          const chunk = await reader.read();

          if (chunk.done) break;

          const remaining = MAX_RESPONSE_BYTES - received;

          if (chunk.value.byteLength > remaining) {
            responseText += decoder.decode(
              chunk.value.slice(0, remaining),
              { stream: true }
            );

            truncated = true;
            await reader.cancel();
            break;
          }

          received += chunk.value.byteLength;
          responseText += decoder.decode(chunk.value, {
            stream: true,
          });
        }

        responseText += decoder.decode();
      } else {
        const text = await response.text();
        truncated = text.length > MAX_RESPONSE_BYTES;
        responseText = text.slice(0, MAX_RESPONSE_BYTES);
      }

      const contentType =
        response.headers.get("content-type") ?? "unknown";

      if (contentType.includes("json") && !truncated) {
        try {
          responseText = JSON.stringify(
            JSON.parse(responseText),
            null,
            2
          );
        } catch {
          // Preserve non-JSON or malformed response text.
        }
      }

      return {
        status: response.status,
        statusText: response.statusText,
        durationMs: Math.round(performance.now() - started),
        contentType,
        body: responseText.slice(0, 160_000),
        truncated,
        viaProxy: false,
      };
    };

    try {
      // Explicit null sentinel: strict TypeScript can prove every path
      // either assigns a real result or throws before setResult runs.
      let apiResult: ApiResult | null = null;

      if (isExternal) {
        // Direct browser attempt, short timeout.
        try {
          const direct = await fetch(target.toString(), {
            method,
            headers,
            body: bodyText ?? undefined,
            credentials: "omit",
            redirect: "error",
            referrerPolicy: "no-referrer",
            cache: "no-store",
            mode: "cors",
            signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS),
          });
          apiResult = await finishDirect(direct);
        } catch {
          apiResult = null;
        }

        if (apiResult === null) {
          // CORS or network blocked the direct call; retry via proxy.
          const proxied = await fetchViaProxy(
            target,
            headers,
            bodyText,
            PROXY_TIMEOUT_MS
          );

          if (!proxied.ok) {
            throw new Error(proxied.statusText || "The request could not be completed.");
          }

          let responseText = proxied.body;
          let truncated = responseText.length > MAX_RESPONSE_BYTES;
          if (truncated) responseText = responseText.slice(0, MAX_RESPONSE_BYTES);

          if (proxied.contentType.includes("json") && !truncated) {
            try {
              responseText = JSON.stringify(JSON.parse(responseText), null, 2);
            } catch {
              // Preserve as-is.
            }
          }

          apiResult = {
            status: proxied.status,
            statusText: proxied.statusText,
            durationMs: Math.round(performance.now() - started),
            contentType: proxied.contentType,
            body: responseText.slice(0, 160_000),
            truncated,
            viaProxy: true,
          };
        }
      } else {
        // Same-origin request: direct, no proxy involved.
        const response = await fetch(target.toString(), {
          method,
          headers,
          body: bodyText ?? undefined,
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: controller.signal,
        });
        apiResult = await finishDirect(response);
      }

      if (apiResult === null) {
        throw new Error("The request could not be completed.");
      }

      setResult(apiResult);
    } catch (cause) {
      if (controller.signal.aborted) {
        setError("Request timed out or was cancelled.");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You are offline. The API tester requires an internet connection.");
      } else {
        setError(
          "Request failed. Check the URL and connection. " +
          (cause instanceof Error ? cause.message : "")
        );
      }
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  }

  return (
    <section
      className={styles.root}
      aria-label="API Request Tester"
    >
      <div className={styles.heading}>
        <strong>API Request Tester</strong>
        <span>Browser HTTP client</span>
      </div>

      <p className={styles.description}>
        Send HTTP requests and inspect responses. External endpoints are
        tried directly, then through the FORGEX server proxy when the
        browser blocks them. Cookies are not sent. Do not enter private
        API keys or secrets.
      </p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void sendRequest();
        }}
      >
        <div className={styles.requestRow}>
          <select
            aria-label="HTTP method"
            value={method}
            disabled={busy}
            onChange={(event) =>
              setMethod(event.target.value as Method)
            }
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          <input
            type="text"
            aria-label="API endpoint URL"
            placeholder="https://api.example.com/items"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={busy}
            spellCheck={false}
            maxLength={2048}
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? "Sending..." : "Send"}
          </button>

          {busy && (
            <button
              type="button"
              className={styles.cancel}
              onClick={() => controllerRef.current?.abort()}
            >
              Cancel
            </button>
          )}
        </div>

        <details className={styles.details}>
          <summary>Request headers (JSON)</summary>
          <textarea
            aria-label="Request headers JSON"
            value={headersText}
            disabled={busy}
            onChange={(event) =>
              setHeadersText(event.target.value)
            }
            rows={3}
            spellCheck={false}
          />
        </details>

        {method === "POST" && (
          <div className={styles.bodySection}>
            <label htmlFor="forgex-api-body">
              Request body (JSON)
            </label>
            <textarea
              id="forgex-api-body"
              value={requestBody}
              disabled={busy}
              onChange={(event) =>
                setRequestBody(event.target.value)
              }
              rows={5}
              spellCheck={false}
            />
          </div>
        )}
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className={styles.response} role="status">
          <div className={styles.responseHeader}>
            <strong
              className={
                result.status >= 400
                  ? styles.statusError
                  : styles.statusOk
              }
            >
              HTTP {result.status} {result.statusText}
            </strong>
            <span>{result.durationMs} ms</span>
            <span>{result.contentType}</span>
            {result.viaProxy && <span>via proxy</span>}
          </div>

          <pre>
            {result.body || "(empty response)"}
          </pre>

          {result.truncated && (
            <p className={styles.warning}>
              Response preview truncated at 120 KB.
            </p>
          )}
        </div>
      )}
    </section>
  );
}