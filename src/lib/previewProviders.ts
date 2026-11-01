// Approved preview provider registry. Only providers listed here may run.
// Arbitrary URLs or providers are never accepted (no open proxy).

export const APPROVED_PROVIDER_KEYS = [
  "weather.current",
  "forgex.health",
] as const;

export type ApprovedProviderKey =
  (typeof APPROVED_PROVIDER_KEYS)[number];

export function isApprovedProvider(key: string): key is ApprovedProviderKey {
  return (APPROVED_PROVIDER_KEYS as readonly string[]).includes(key);
}

export function makeProviderKey(provider: string, action: string): string {
  return `${provider}.${action}`;
}

export function validateCoordinates(
  latitude: unknown,
  longitude: unknown,
): { ok: true } | { ok: false; error: string } {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, error: "Invalid geographical coordinates." };
  }
  return { ok: true };
}