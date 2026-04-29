import { NFL_STADIUM_BY_TEAM_ABBR } from "./stadium-locations";

export type WeatherData = {
  tempF: number;
  condition: string;
  windMph: number;
};

type OwmWeatherResponse = {
  main?: { temp?: number };
  wind?: { speed?: number };
  weather?: Array<{ description?: string; main?: string }>;
};

/**
 * Current conditions near the home team's stadium (OpenWeatherMap Current Weather).
 * Returns `null` on any failure — never throws to callers.
 */
export async function fetchWeatherForTeam(abbreviation: string): Promise<WeatherData | null> {
  const key = process.env.WEATHER_API_KEY?.trim();
  if (!key) {
    return null;
  }

  const upper = abbreviation.trim().toUpperCase();
  const coords = NFL_STADIUM_BY_TEAM_ABBR[upper];
  if (!coords) {
    return null;
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
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

  const data = body as OwmWeatherResponse;
  const tempF = data.main?.temp;
  if (typeof tempF !== "number" || !Number.isFinite(tempF)) {
    return null;
  }

  const rawWind = data.wind?.speed;
  const windMph = typeof rawWind === "number" && Number.isFinite(rawWind) ? rawWind : 0;

  const desc =
    typeof data.weather?.[0]?.description === "string" && data.weather[0].description.length > 0
      ? data.weather[0].description.replace(/\b\w/g, (c) => c.toUpperCase())
      : typeof data.weather?.[0]?.main === "string"
        ? data.weather[0].main
        : "Conditions";

  return {
    tempF: Math.round(tempF),
    windMph: Math.round(windMph),
    condition: desc,
  };
}
