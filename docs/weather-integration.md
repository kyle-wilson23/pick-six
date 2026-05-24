# Weather Integration

## Provider Decision Record — Story 3.10

### Options Evaluated

| Provider | Endpoint | Horizon | Granularity | Free Tier |
|----------|----------|---------|-------------|-----------|
| OWM `/data/2.5/forecast` | `GET /data/2.5/forecast` | ~5 days (40 × 3-hour slots) | 3-hour intervals | Free, **no credit card required** |
| OWM One Call 3.0 | `GET /onecall` | 8 days | Hourly | Free tier, but **requires credit card on file** |

### Decision: OWM `/data/2.5/forecast`

**Chosen option:** `GET https://api.openweathermap.org/data/2.5/forecast`

**Rationale:**

1. **No credit card required** — OWM One Call 3.0 requires a billing method on file even for free usage. This creates unnecessary friction for a hobby project where free-tier simplicity is a priority.
2. **Sufficient horizon for most games** — Thursday Night Football (~2 days from Tuesday) and Sunday games (~5 days from Tuesday) are covered. The 5-day window aligns well with the typical weekly picks workflow.
3. **Same API key** — uses the existing `WEATHER_API_KEY` with no new credentials or account changes.
4. **3-hour granularity is acceptable** — nearest-slot selection (smallest `|entry.dt − kickoffAt|`) provides a reasonable approximation for a 3+ hour game window.

**Horizon tradeoff:**

| Game | Days from Tuesday | Covered? |
|------|-------------------|----------|
| Thursday Night Football | ~2 days | ✅ Yes |
| Sunday afternoon games | ~5 days | ✅ Yes (at edge of window) |
| Monday Night Football | ~6 days | ❌ No — silently omitted |

Monday Night Football falls outside the 5-day free-tier horizon. Per AC #2, the weather chip is silently omitted when `kickoffAt` is beyond the forecast window — no stale current-conditions fallback is shown. This tradeoff is explicitly acceptable per the story requirements.

---

## Implementation Overview

### Endpoint

```
GET https://api.openweathermap.org/data/2.5/forecast
  ?lat={lat}&lon={lon}&appid={WEATHER_API_KEY}&units=imperial
```

### Null-return conditions (weather chip silently omitted)

`fetchWeatherForGame` returns `null` — and no weather chip is shown — in any of the following cases:

| Condition | Reason |
|-----------|--------|
| `WEATHER_API_KEY` not set | Key absent |
| Unknown team abbreviation | No stadium coordinates |
| `kickoffAt` is an invalid date (`NaN`) | Unresolvable kickoff |
| `kickoffAt` is in the past | Game already kicked off |
| `kickoffAt` is more than 5 days away | Outside free-tier forecast horizon |
| API call fails or returns non-OK status | Fail-soft |
| Response contains no usable data | Empty or malformed list |

**Dome stadiums** (`roof: "dome"` in `NFL_STADIUM_BY_TEAM_ABBR`) skip the weather fetch entirely at the call site in `build-league-picks-week-view.ts` — weather is irrelevant for indoor venues. The `MatchupCard` UI shows an "Indoor" chip instead.

**Retractable-roof stadiums** (`roof: "retractable"`) do fetch weather, since the roof may be open or closed on game day. Weather data is shown with a tooltip noting the roof may be open or closed. If weather is unavailable (e.g., outside the forecast horizon), a "Retractable Roof" chip is shown as a fallback.

### Forecast-Slot Selection

1. If `kickoffAt` is invalid or in the past, return `null` immediately (no network call).
2. If `kickoffAt` is more than 5 days from `Date.now()`, return `null` immediately (no network call).
3. Fetch the forecast list (up to 40 entries, 3-hour intervals).
4. Pick the entry with the smallest `|entry.dt − kickoffAt.getTime() / 1000|`.
5. Map to `WeatherData` (`tempF`, `condition`, `windMph`).
6. Return `null` on any error or empty list.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `WEATHER_API_KEY` | OpenWeatherMap API key (server-only, never `NEXT_PUBLIC_*`) | Optional — weather silently omitted when absent |

See also: `docs/nfl-odds-integration.md` for the broader third-party integration context.

### Files

| Area | File |
|------|------|
| Weather client | `src/lib/integrations/weather/client.ts` |
| Stadium coordinates | `src/lib/integrations/weather/stadium-locations.ts` |
| Tests | `src/lib/integrations/weather/client.test.ts` |
| Fixture | `src/lib/integrations/weather/fixtures/owm-forecast-sample.json` |
