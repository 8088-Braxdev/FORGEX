
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const requestTimestamps = new Map<string, number[]>();

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (requestTimestamps.get(key) ?? []).filter(
    (value) => now - value < windowMs,
  );

  if (recent.length >= limit) {
    requestTimestamps.set(key, recent);
    return true;
  }

  recent.push(now);
  requestTimestamps.set(key, recent);
  return false;
}

type Payload = Record<string, unknown>;

type Handler = (
  payload: Payload
) => Promise<NextResponse>;

type WeatherResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
};

async function currentWeather(
  payload: Payload
): Promise<NextResponse> {
  const { latitude, longitude } = payload;

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
    return NextResponse.json(
      { error: "Invalid geographical coordinates." },
      { status: 400 }
    );
  }

  const url = new URL(
    "https://api.open-meteo.com/v1/forecast"
  );

  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,wind_speed_10m"
  );

  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Weather provider unavailable." },
      { status: 502 }
    );
  }

  const data = (await response.json()) as WeatherResponse;
  const current = data.current;

  if (
    !current ||
    typeof current.temperature_2m !== "number"
  ) {
    return NextResponse.json(
      { error: "Invalid weather response." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    provider: "Open-Meteo",
    action: "current",
    coordinates: { latitude, longitude },
    current: {
      time: current.time ?? null,
      temperatureC: current.temperature_2m,
      humidityPercent:
        current.relative_humidity_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
    },
    attribution: "Open-Meteo",
  });
}

// Only explicitly registered providers can run.
const providers = new Map<string, Handler>([
  ["weather.current", currentWeather],
]);

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not found." },
      { status: 404 }
    );
  }

  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403 }
    );
  }

  if (rateLimited(clientKey(request), 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many preview requests. Try again later." },
      { status: 429 }
    );
  }

  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: "JSON is required." },
      { status: 415 }
    );
  }

  try {
    const raw = await request.text();

    if (raw.length > 1024) {
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 }
      );
    }

    const value: unknown = JSON.parse(raw);

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const payload = value as Payload;

    if (
      typeof payload.provider !== "string" ||
      typeof payload.action !== "string"
    ) {
      return NextResponse.json(
        { error: "Provider and action are required." },
        { status: 400 }
      );
    }

    const handler = providers.get(
      `${payload.provider}.${payload.action}`
    );

    if (!handler) {
      return NextResponse.json(
        { error: "Provider action not approved." },
        { status: 403 }
      );
    }

    const result = await handler(payload);
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch {
    return NextResponse.json(
      { error: "Invalid request or provider unavailable." },
      { status: 502 }
    );
  }
}
