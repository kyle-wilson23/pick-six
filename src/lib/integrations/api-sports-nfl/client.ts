import { apiSportsGamesEnvelopeSchema } from "./schemas";

const DEFAULT_HOST = "v1.american-football.api-sports.io";

export class ApiSportsNflError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "ApiSportsNflError";
  }
}

function gamesUrl(): string {
  const host = process.env.API_SPORTS_HOST?.trim() || DEFAULT_HOST;
  return `https://${host}/games`;
}

function gamesHeaders(apiKey: string): Record<string, string> {
  const host = process.env.API_SPORTS_HOST?.trim() || DEFAULT_HOST;
  if (host.includes("rapidapi.com")) {
    return {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": host,
    };
  }
  return { "x-apisports-key": apiKey };
}

/**
 * Fetches full-season NFL games for `nflSeasonYear` from API-Sports American Football. **Server-only** — pass key from env.
 * One HTTP call per sync; filter regular season weeks 1–18 in `map-schedule`.
 */
export async function fetchNflGamesForSeason(apiKey: string, nflSeasonYear: number): Promise<ReturnType<typeof apiSportsGamesEnvelopeSchema.parse>> {
  const url = new URL(gamesUrl());
  url.searchParams.set("league", "1");
  url.searchParams.set("season", String(nflSeasonYear));
  url.searchParams.set("timezone", "UTC");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: gamesHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ApiSportsNflError(`API-Sports NFL network error: ${msg}`, 0, msg.slice(0, 200));
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ApiSportsNflError(`API-Sports NFL HTTP ${res.status}`, res.status, text.slice(0, 500));
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiSportsNflError("API-Sports NFL returned non-JSON", res.status, text.slice(0, 200));
  }

  const parsed = apiSportsGamesEnvelopeSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiSportsNflError("API-Sports NFL payload failed validation", res.status, text.slice(0, 300));
  }

  const err = parsed.data.errors;
  const errIsEmpty =
    err == null || (Array.isArray(err) && err.length === 0) || (typeof err === "object" && !Array.isArray(err) && Object.keys(err).length === 0);
  if (!errIsEmpty) {
    throw providerErrorsToApiSportsError(err, 502);
  }

  console.info(
    JSON.stringify({
      action: "api_sports_nfl_games_response",
      httpStatus: res.status,
      bodyChars: text.length,
      gameCount: parsed.data.response.length,
      nflSeasonYear,
    }),
  );

  return parsed.data;
}

function providerErrorsToApiSportsError(errors: unknown, status: number): ApiSportsNflError {
  const snippet = typeof errors === "string" ? errors : JSON.stringify(errors).slice(0, 400);
  return new ApiSportsNflError(`API-Sports NFL errors: ${snippet}`, status, snippet);
}
