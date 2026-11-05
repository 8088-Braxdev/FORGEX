# Patch notes — Preview API fixes (part 2)

Status: the proxy route fix is committed directly (it forwards
`x-goog-api-key`, `x-goog-user-project` and `x-api-key`). This file
documents the two remaining fixes inside `src/lib/ideCore.ts` (35 KB,
rewritten only through an exact patch like `PATCH_LIVE_HEALTH_SCORE.md`).

Why part 2 is needed:

- The preview console shows `Blocked by sandbox security policy:
  https://api.fontshare.com/v2/css...` — the font CDN is not in the
  preview `style-src` allow-list.
- Projects that call APIs with XMLHttpRequest (axios and older SDKs)
  never retry through the proxy: the direct call fails against
  `Origin: null`, the XHR wrapper only emits a warning, and the app
  silently shows nothing while the Network tab reports 200 for the
  request that did reach the server.

Apply both patches, then run:

```bash
npm run typecheck
node --test tests/*.test.cjs
npm run build
```

---

## Patch A — Allow api.fontshare.com styles in the preview sandbox

**File:** `src/lib/ideCore.ts`

**Find** the preview CSP host list used for `style-src` — the constant
(or template) that currently contains exactly these four hosts:

```
https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com
```

**Add** `https://api.fontshare.com` to that list (keep
`https://fonts.gstatic.com` and any other entries already present).

The CSP error in the preview console is:

```
Loading the stylesheet 'https://api.fontshare.com/v2/css?...'
violates the following Content Security Policy directive:
"style-src 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com
https://cdnjs.cloudflare.com https://fonts.googleapis.com".
```

Only stylesheets are affected; scripts stay on the stricter list.

---

## Patch B — XHR proxy fallback so axios-style API calls show real responses

**File:** `src/lib/ideCore.ts` (inside the `instrument` template string,
in the preview sandbox script)

**Find** the current XHR wrapper (added in PR #9):

```js
// XHR uses the same strategy: direct https first, proxy fallback on
// failure, and a clear rejection for relative non-bridge URLs.
(function(){
  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') {
      if (isExternalHttpsUrl(url)) {
        this.addEventListener('error', function() {
          emit('warn', ['Direct request failed; the target API may not allow browser origins. Use fetch for automatic proxy fallback: ' + url], 'Preview sandbox');
        });
        return originalOpen.apply(this, arguments);
      }
      if (
        url.charAt(0) === '/' &&
        PROXYABLE_BRIDGES.indexOf(url) === -1
      ) {
        throw new Error('Blocked: relative URL "' + url + '" resolves to the FORGEX origin. Call your API with its full https:// address.');
      }
    }
    return originalOpen.apply(this, arguments);
  };
})();
```

**Replace with:**

```js
// XHR retries through the preview proxy when the direct call fails,
// so axios-style projects receive real API responses. The proxy
// forwards provider auth headers (x-goog-api-key, x-api-key,
// authorization) and performs a genuine server-to-server request.
(function(){
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__forgexMethod = method;
    this.__forgexUrl = typeof url === 'string' ? url : null;
    if (
      typeof url === 'string' &&
      url.charAt(0) === '/' &&
      !isExternalHttpsUrl(url) &&
      PROXYABLE_BRIDGES.indexOf(url) === -1
    ) {
      throw new Error('Blocked: relative URL "' + url + '" resolves to the FORGEX origin. Call your API with its full https:// address.');
    }
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    var xhr = this;
    var url = xhr.__forgexUrl;
    var method = xhr.__forgexMethod || 'GET';

    if (!url || !isExternalHttpsUrl(url)) {
      return originalSend.apply(this, arguments);
    }

    // Try direct first; on failure (Origin: null blocks the response)
    // retry through the proxy exactly like the fetch shim does.
    xhr.addEventListener('error', function() {
      var bodyText = typeof body === 'string' ? body : null;
      var headers = {};
      try {
        var setHeaders = xhr.__forgexHeaders || {};
        for (var name in setHeaders) headers[name] = setHeaders[name];
      } catch (error) { headers = {}; }

      originalFetch.call(window, PREVIEW_PROXY_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: url, method: method, headers: headers, body: bodyText })
      }).then(function(proxyResponse) {
        return proxyResponse.json().then(function(envelope) {
          Object.defineProperty(xhr, 'status', { value: envelope.status || 502 });
          Object.defineProperty(xhr, 'responseText', {
            value: typeof envelope.body === 'string' ? envelope.body : ''
          });
          Object.defineProperty(xhr, 'response', {
            value: typeof envelope.body === 'string' ? envelope.body : ''
          });
          xhr.readyState = 4;
          if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('loadend'));
        });
      }).catch(function() {
        emit('warn', ['Direct request failed and the FORGEX proxy could not complete it either: ' + url], 'Preview sandbox');
        xhr.dispatchEvent(new Event('error'));
        xhr.dispatchEvent(new Event('loadend'));
      });
    });

    return originalSend.apply(this, arguments);
  };

  // Capture request headers set via setRequestHeader so the proxy
  // retry can forward the API key (x-goog-api-key, authorization...).
  var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (!this.__forgexHeaders) this.__forgexHeaders = {};
    this.__forgexHeaders[name] = value;
    return originalSetRequestHeader.apply(this, arguments);
  };
})();
```

Behavior notes:

- Direct-first, proxy-retry — same two-stage strategy as the fetch shim.
- `setRequestHeader` headers are forwarded to the proxy retry; the
  proxy's allow-list still decides which ones reach the target.
- Relative non-bridge URLs still fail fast with the clear message.
- `emit` and `originalFetch` already exist in the sandbox script; no new
  globals are introduced.

---

## Acceptance checks after applying

1. A fetch-based AI project (Gemini, key in `x-goog-api-key` header or
   `?key=` query param) returns real model output inside the preview.
2. An XHR/axios project calling an external HTTPS API renders real
   response data; the Network tab no longer shows a lone 200 with
   nothing displayed.
3. The Fontshare stylesheet loads; the two blocked-stylesheet errors
   disappear from the preview console.
4. `npm run typecheck`, `node --test tests/*.test.cjs`, `npm run build`
   pass at the applied commit.