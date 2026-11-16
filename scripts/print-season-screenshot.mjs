#!/usr/bin/env node
/**
 * Print one past-season screenshot as a grid. Writes nothing.
 *
 * Usage:
 *   BOOK_VISION_MODEL_ID=... node scripts/print-season-screenshot.mjs 2024.png
 *
 * The season year rule matches getCurrentNflSeasonYear: NFL_SEASON_YEAR when that
 * value is an integer from 2000 through 2100, otherwise the UTC calendar year.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { generateText, Output } from "ai";
import { z } from "zod";

const FILL_WORDS = ["green", "pale blue", "red", "empty red", "yellow", "orange"];
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const screenshotCellSchema = z.object({
  firstName: z.string(),
  week: z.number().int(),
  fill: z.enum(FILL_WORDS),
  team: z.string().nullish(),
});

/** Structured screenshot grid. One object per cell. */
export const screenshotSheetSchema = z.object({
  cells: z.array(screenshotCellSchema),
});

const INSTRUCTION = [
  "Read the image as a grid of cells.",
  "Each cell has the columns first name, week, fill, and team.",
  "Fill is green, pale blue, red, empty red, yellow, or orange.",
  "Team is the text named in the cell, or blank when none is named.",
  "A red cell with no team is empty red.",
].join(" ");

function currentNflSeasonYear(env, now) {
  const raw = env.NFL_SEASON_YEAR;
  if (raw !== undefined && raw !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 2000 && n <= 2100) {
      return n;
    }
  }
  return now.getUTCFullYear();
}

function rejection(stderr, message) {
  stderr.write(`${message}\n`);
  return 1;
}

function classifyFile(filePath, env, now) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return { ok: false, message: "a screenshot file is required" };
  }

  const extension = path.extname(filePath).toLowerCase();
  const stem = path.basename(filePath, path.extname(filePath));

  if (extension === ".csv") {
    return { ok: false, message: "plain CSV is not a past season" };
  }
  if (!IMAGE_EXTENSIONS.has(extension)) {
    return { ok: false, message: "screenshot must be png, jpg, jpeg, or webp" };
  }
  if (!/^\d{4}$/.test(stem)) {
    return { ok: false, message: "filename stem must be a season year from 2000 through 2100" };
  }

  const year = Number.parseInt(stem, 10);
  if (year < 2000 || year > 2100) {
    return { ok: false, message: "filename stem must be a season year from 2000 through 2100" };
  }
  if (year === currentNflSeasonYear(env, now)) {
    return { ok: false, message: "current season is not a past season" };
  }
  return { ok: true };
}

function breaksColumns(value) {
  return /[|\r\n]/.test(value);
}

function teamText(team) {
  if (team == null) return "";
  if (typeof team !== "string") return null;
  if (breaksColumns(team)) return null;
  return team.trim();
}

function readGrid(cells) {
  if (!Array.isArray(cells)) {
    return { ok: false, message: "model returned no output" };
  }

  const rows = [];
  const seen = new Set();
  for (const cell of cells) {
    if (cell == null || typeof cell !== "object") {
      return { ok: false, message: "screenshot reading is not a grid" };
    }
    const firstName = cell.firstName;
    const week = cell.week;
    const fill = cell.fill;
    if (typeof firstName !== "string" || breaksColumns(firstName)) {
      return { ok: false, message: "screenshot reading is not a grid" };
    }
    if (typeof week !== "number" || !Number.isInteger(week)) {
      return { ok: false, message: "week is not an integer" };
    }
    if (!FILL_WORDS.includes(fill)) {
      return { ok: false, message: "fill is not a known color" };
    }
    const team = teamText(cell.team);
    if (team == null) {
      return { ok: false, message: "screenshot reading is not a grid" };
    }
    const key = `${firstName}\0${week}`;
    if (seen.has(key)) {
      return { ok: false, message: "repeated first name and week" };
    }
    seen.add(key);
    rows.push({
      firstName,
      week,
      fill: fill === "red" && team === "" ? "empty red" : fill,
      team,
    });
  }

  rows.sort((a, b) => {
    if (a.firstName < b.firstName) return -1;
    if (a.firstName > b.firstName) return 1;
    return a.week - b.week;
  });
  return { ok: true, rows };
}

function formatGrid(rows) {
  const lines = ["first name | week | fill | team"];
  for (const row of rows) {
    lines.push(`${row.firstName} | ${row.week} | ${row.fill} | ${row.team}`.trimEnd());
  }
  return `${lines.join("\n")}\n`;
}

function modelIdFrom(env) {
  const raw = env.BOOK_VISION_MODEL_ID;
  return typeof raw === "string" ? raw.trim() : "";
}

export async function printSeasonScreenshot(filePath, options = {}) {
  const env = options.env ?? process.env;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const now = options.now ?? new Date();

  const classified = classifyFile(filePath, env, now);
  if (!classified.ok) return rejection(stderr, classified.message);

  const modelId = modelIdFrom(env);
  if (modelId === "") return rejection(stderr, "missing BOOK_VISION_MODEL_ID");

  let bytes;
  try {
    bytes = readFileSync(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return rejection(stderr, message);
  }

  let result;
  try {
    result = await generateText({
      model: modelId,
      output: Output.object({ schema: screenshotSheetSchema }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: INSTRUCTION },
            { type: "image", image: bytes },
          ],
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim() !== "" ? error.message : "model call failed";
    return rejection(stderr, message);
  }

  if (result?.output == null) return rejection(stderr, "model returned no output");

  const grid = readGrid(result.output.cells);
  if (!grid.ok) return rejection(stderr, grid.message);

  stdout.write(formatGrid(grid.rows));
  return 0;
}

const isDirectRun =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const code = await printSeasonScreenshot(process.argv[2]);
  process.exit(code);
}
