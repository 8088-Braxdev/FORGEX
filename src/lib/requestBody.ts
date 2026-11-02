export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function readSmallJson(request: Request, maxBytes = 1024): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new RequestBodyError('JSON is required.', 415);
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new RequestBodyError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError('A JSON body is required.', 400);
  const decoder = new TextDecoder(); let bytes = 0; let text = ''; let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new RequestBodyError('Request timed out.', 408)); }, 5000); });
    await Promise.race([timeout, (async () => {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) { await reader.cancel(); throw new RequestBodyError('Request is too large.', 413); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    })()]);
    try { return JSON.parse(text); } catch { throw new RequestBodyError('Invalid JSON.', 400); }
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
}
