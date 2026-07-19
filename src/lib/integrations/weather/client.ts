import { NFL_STADIUM_BY_TEAM_ABBR } from "./stadium-locations";

export type WeatherData = {
  tempF: number;
  condition: string;
  windMph: number;
};

type OwmForecastResponse = {
  list?: Array<{
    dt?: number;
    main?: { temp?: number };
    wind?: { speed?: number };
    weather?: Array<{ description?: string; main?: string }>;
  }>;
};

/** 5-day horizon in seconds for OWM /data/2.5/forecast free tier. */
const FORECAST_HORIZON_SECONDS = 5 * 24 * 60 * 60;

/** In-memory TTL so Sunday SSR traffic does not burn OWM quota per request. */
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

type WeatherCacheEntry = {
  expiresAt: number;
  value: WeatherData | null;
};

const weatherCache = new Map<string, WeatherCacheEntry>();
const weatherInflight = new Map<string, Promise<WeatherData | null>>();

function weatherCacheKey(abbreviation: string, kickoffAt: Date): string {
  return `${abbreviation}:${kickoffAt.toISOString()}`;
}

/** Test-only: clear module cache between cases. */
export function clearWeatherCacheForTests(): void {
  weatherCache.clear();
  weatherInflight.clear();
}

/**
 * Forecast conditions near the home team's stadium at kickoff time (OpenWeatherMap Forecast).
 *
 * Returns `null` when:
 * - `WEATHER_API_KEY` is absent
 * - `kickoffAt` is beyond the ~5-day free-tier forecast horizon
 * - The API call fails or returns a non-OK status
 * - The response contains no usable data
 *
 * Never throws to callers.
 */
export async function fetchWeatherForGame(
  abbreviation: string,
  kickoffAt: Date,
): Promise<WeatherData | null> {
  const key = process.env.WEATHER_API_KEY?.trim();
  if (!key) {
    return null;
  }

  const upper = abbreviation.trim().toUpperCase();
  const coords = NFL_STADIUM_BY_TEAM_ABBR[upper];
  if (!coords) {
    return null;
  }

  const nowSeconds = Date.now() / 1000;
  const kickoffSeconds = kickoffAt.getTime() / 1000;

  if (!isFinite(kickoffSeconds)) {
    return null;
  }

  if (kickoffSeconds < nowSeconds) {
    return null;
  }

  // Return null early — no network call — when outside the forecast horizon.
  if (kickoffSeconds - nowSeconds > FORECAST_HORIZON_SECONDS) {
    return null;
  }

  const cacheKey = weatherCacheKey(upper, kickoffAt);
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingInflight = weatherInflight.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const promise = (async () => {
    try {
      const value = await fetchWeatherFromApi(upper, coords, kickoffSeconds, key);
      weatherCache.set(cacheKey, {
        expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
        value,
      });
      return value;
    } finally {
      weatherInflight.delete(cacheKey);
    }
  })();

  weatherInflight.set(cacheKey, promise);
  return promise;
}

async function fetchWeatherFromApi(
  upper: string,
  coords: { lat: number; lon: number },
  kickoffSeconds: number,
  key: string,
): Promise<WeatherData | null> {
  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("lat", String(coords.lat));
  url.searchParams.set("lon", String(coords.lon));
  url.searchParams.set("appid", key);
  url.searchParams.set("units", "imperial");

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(3000) });
  } catch {
    console.warn("[weather] fetch failed", { abbreviation: upper });
    return null;
  }

  if (!res.ok) {
    console.warn("[weather] non-OK response", { abbreviation: upper, status: res.status });
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const data = body as OwmForecastResponse;
  const list = data.list;
  if (!list || list.length === 0) {
    return null;
  }

  // Pick the forecast entry whose `dt` is closest to the kickoff timestamp.
  let best = list[0];
  let bestDiff = Math.abs((best.dt ?? 0) - kickoffSeconds);
  for (let i = 1; i < list.length; i++) {
    const entry = list[i];
    const diff = Math.abs((entry.dt ?? 0) - kickoffSeconds);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }

  const tempF = best.main?.temp;
  if (typeof tempF !== "number" || !Number.isFinite(tempF)) {
    return null;
  }

  const rawWind = best.wind?.speed;
  const windMph = typeof rawWind === "number" && Number.isFinite(rawWind) ? rawWind : 0;

  const desc =
    typeof best.weather?.[0]?.description === "string" && best.weather[0].description.length > 0
      ? best.weather[0].description.replace(/\b\w/g, (c) => c.toUpperCase())
      : typeof best.weather?.[0]?.main === "string"
        ? best.weather[0].main.replace(/\b\w/g, (c) => c.toUpperCase())
        : "Conditions";

  return {
    tempF: Math.round(tempF),
    windMph: Math.max(0, Math.round(windMph)),
    condition: desc,
  };
}
