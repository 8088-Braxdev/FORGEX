
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
};

const MAX_RESPONSE_BYTES = 120_000;

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
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetch(target.toString(), {
        method,
        headers,
        body:
          method === "POST" && requestBody.trim()
            ? requestBody
            : undefined,
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        mode: "cors",
        signal: controller.signal,
      });

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

      setResult({
        status: response.status,
        statusText: response.statusText,
        durationMs: Math.round(performance.now() - started),
        contentType,
        body: responseText.slice(0, 160_000),
        truncated,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        setError("Request timed out or was cancelled.");
      } else {
        setError(
          "Request failed. Check the URL, connection, and browser CORS permissions. " +
          (cause instanceof Error ? cause.message : "")
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
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
        Send HTTP requests and inspect responses. External
        endpoints must allow browser CORS. Cookies are not sent.
        Do not enter private API keys or secrets.
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
