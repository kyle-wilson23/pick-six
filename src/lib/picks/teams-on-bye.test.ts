import { describe, expect, it } from "vitest";

import { teamsOnBye, type ByeTeam } from "./teams-on-bye";

function team(id: string, abbreviation: string, name: string): ByeTeam {
  return { id, abbreviation, name };
}

const catalog: ByeTeam[] = [
  team("ari", "ARI", "Arizona Cardinals"),
  team("atl", "ATL", "Atlanta Falcons"),
  team("bal", "BAL", "Baltimore Ravens"),
  team("buf", "BUF", "Buffalo Bills"),
  team("car", "CAR", "Carolina Panthers"),
  team("chi", "CHI", "Chicago Bears"),
  team("cin", "CIN", "Cincinnati Bengals"),
  team("cle", "CLE", "Cleveland Browns"),
  team("dal", "DAL", "Dallas Cowboys"),
  team("den", "DEN", "Denver Broncos"),
  team("det", "DET", "Detroit Lions"),
  team("gb", "GB", "Green Bay Packers"),
  team("hou", "HOU", "Houston Texans"),
  team("ind", "IND", "Indianapolis Colts"),
  team("jax", "JAX", "Jacksonville Jaguars"),
  team("kc", "KC", "Kansas City Chiefs"),
  team("lac", "LAC", "Los Angeles Chargers"),
  team("lar", "LAR", "Los Angeles Rams"),
  team("lv", "LV", "Las Vegas Raiders"),
  team("mia", "MIA", "Miami Dolphins"),
  team("min", "MIN", "Minnesota Vikings"),
  team("ne", "NE", "New England Patriots"),
  team("no", "NO", "New Orleans Saints"),
  team("nyg", "NYG", "New York Giants"),
  team("nyj", "NYJ", "New York Jets"),
  team("phi", "PHI", "Philadelphia Eagles"),
  team("pit", "PIT", "Pittsburgh Steelers"),
  team("sea", "SEA", "Seattle Seahawks"),
  team("sf", "SF", "San Francisco 49ers"),
  team("tb", "TB", "Tampa Bay Buccaneers"),
  team("ten", "TEN", "Tennessee Titans"),
  team("was", "WAS", "Washington Commanders"),
];

/** 16 home/away pairs covering every catalog id in order. */
function fullCardGames() {
  const games = [];
  for (let i = 0; i < catalog.length; i += 2) {
    games.push({ homeTeamId: catalog[i]!.id, awayTeamId: catalog[i + 1]!.id });
  }
  return games;
}

describe("teamsOnBye", () => {
  it("hides when all 32 teams play a 16-game card", () => {
    expect(teamsOnBye(catalog, fullCardGames())).toEqual([]);
  });

  it("lists clubs omitted from a 15-game card, sorted by name then abbreviation", () => {
    const playing = catalog.filter((t) => t.id !== "atl" && t.id !== "car");
    const games = [];
    for (let i = 0; i < playing.length; i += 2) {
      games.push({ homeTeamId: playing[i]!.id, awayTeamId: playing[i + 1]!.id });
    }
    expect(games).toHaveLength(15);
    expect(teamsOnBye(catalog, games)).toEqual([
      team("atl", "ATL", "Atlanta Falcons"),
      team("car", "CAR", "Carolina Panthers"),
    ]);
  });

  it("lists all omitted clubs on a 13-game card", () => {
    const byeIds = new Set(["atl", "car", "chi", "det", "gb", "min"]);
    const playing = catalog.filter((t) => !byeIds.has(t.id));
    const games = [];
    for (let i = 0; i < playing.length; i += 2) {
      games.push({ homeTeamId: playing[i]!.id, awayTeamId: playing[i + 1]!.id });
    }
    expect(games).toHaveLength(13);
    expect(teamsOnBye(catalog, games).map((t) => t.abbreviation)).toEqual([
      "ATL",
      "CAR",
      "CHI",
      "DET",
      "GB",
      "MIN",
    ]);
  });

  it("hides when there are no games (schedule not loaded)", () => {
    expect(teamsOnBye(catalog, [])).toEqual([]);
  });

  it("hides an incomplete slate of 1–12 games instead of treating absences as byes", () => {
    const games = fullCardGames().slice(0, 12);
    expect(games).toHaveLength(12);
    expect(teamsOnBye(catalog, games)).toEqual([]);
  });

  it("derives from the given week games only (query-week isolation)", () => {
    const playing = catalog.filter((t) => t.id !== "atl" && t.id !== "car");
    const week2 = [];
    for (let i = 0; i < playing.length; i += 2) {
      week2.push({ homeTeamId: playing[i]!.id, awayTeamId: playing[i + 1]!.id });
    }
    const week1 = fullCardGames();
    expect(teamsOnBye(catalog, week2).map((t) => t.abbreviation)).toEqual(["ATL", "CAR"]);
    expect(teamsOnBye(catalog, week1)).toEqual([]);
  });

  it("breaks equal names by abbreviation", () => {
    const extra: ByeTeam[] = [
      team("x-zz", "ZZ", "Same Name"),
      team("x-aa", "AA", "Same Name"),
    ];
    expect(teamsOnBye([...catalog, ...extra], fullCardGames())).toEqual([
      team("x-aa", "AA", "Same Name"),
      team("x-zz", "ZZ", "Same Name"),
    ]);
  });
});
