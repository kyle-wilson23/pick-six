/**
 * Approximate home stadium coordinates for NFL franchises (Weather API lookups).
 * Keyed by `Team.abbreviation` (sync with `prisma/data/nfl-teams.json`).
 *
 * `roof` classifies enclosed/covered stadiums:
 *   - `'dome'`        — fixed dome; weather is never a factor
 *   - `'retractable'` — roof that opens/closes; weather may or may not apply
 *   - absent          — outdoor stadium; weather always applies
 */
export type StadiumRoof = "dome" | "retractable";

export const NFL_STADIUM_BY_TEAM_ABBR: Record<
  string,
  { lat: number; lon: number; roof?: StadiumRoof }
> = {
  ARI: { lat: 33.5276, lon: -112.2626, roof: "retractable" }, // State Farm Stadium
  ATL: { lat: 33.7553, lon: -84.401,   roof: "retractable" }, // Mercedes-Benz Stadium
  BAL: { lat: 39.278,  lon: -76.6227 },
  BUF: { lat: 42.7738, lon: -78.787 },
  CAR: { lat: 35.2258, lon: -80.8528 },
  CHI: { lat: 41.8625, lon: -87.6167 },
  CIN: { lat: 39.0954, lon: -84.516 },
  CLE: { lat: 41.5061, lon: -81.6995 },
  DAL: { lat: 32.7473, lon: -97.0925, roof: "retractable" },  // AT&T Stadium
  DEN: { lat: 39.7439, lon: -105.0201 },
  DET: { lat: 42.34,   lon: -83.0456, roof: "dome" },         // Ford Field
  GB:  { lat: 44.5013, lon: -88.0622 },
  HOU: { lat: 29.6847, lon: -95.4107, roof: "retractable" },  // NRG Stadium
  IND: { lat: 39.7601, lon: -86.1639, roof: "retractable" },  // Lucas Oil Stadium
  JAX: { lat: 30.3239, lon: -81.6373 },
  KC:  { lat: 39.0489, lon: -94.4839 },
  LAC: { lat: 33.9535, lon: -118.339, roof: "retractable" },  // SoFi Stadium (enclosed roof, open sides)
  LAR: { lat: 33.9535, lon: -118.339, roof: "retractable" },  // SoFi Stadium (enclosed roof, open sides)
  LV:  { lat: 36.0908, lon: -115.1835, roof: "dome" },        // Allegiant Stadium
  MIA: { lat: 25.9581, lon: -80.2389 },
  MIN: { lat: 44.9736, lon: -93.2581, roof: "dome" },         // U.S. Bank Stadium
  NE:  { lat: 42.0909, lon: -71.2643 },
  NO:  { lat: 29.9511, lon: -90.0812, roof: "dome" },         // Caesars Superdome
  NYG: { lat: 40.8128, lon: -74.0742 },
  NYJ: { lat: 40.8128, lon: -74.0742 },
  PHI: { lat: 39.9008, lon: -75.1675 },
  PIT: { lat: 40.4468, lon: -80.0158 },
  SEA: { lat: 47.5952, lon: -122.3316 },
  SF:  { lat: 37.4032, lon: -121.9694 },
  TB:  { lat: 27.9759, lon: -82.5033 },
  TEN: { lat: 36.1665, lon: -86.7713 },
  WAS: { lat: 38.9077, lon: -76.8644 },
};

/**
 * Returns the stadium roof type for a home team abbreviation,
 * or `null` for outdoor stadiums.
 */
export function getStadiumRoof(abbreviation: string): StadiumRoof | null {
  return NFL_STADIUM_BY_TEAM_ABBR[abbreviation.trim().toUpperCase()]?.roof ?? null;
}
