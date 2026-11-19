// In-memory limits are per serverless instance; they are best-effort only.
export const RATE_LIMIT_WINDOW_MS = 60_000;

type ClientRate = { count: number; startedAt: number; limit: number };
const rateBuckets = new Map<string, ClientRate>();

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

export function rateLimited(key: string, maxRequests = 60): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS || bucket.limit !== maxRequests) {
    rateBuckets.set(key, { count: 1, startedAt: now, limit: maxRequests });
    if (rateBuckets.size > 5000) {
      for (const [bucketKey, value] of rateBuckets) {
        if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) {
          rateBuckets.delete(bucketKey);
        }
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxRequests;
}