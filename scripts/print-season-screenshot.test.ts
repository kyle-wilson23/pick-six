import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Output } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: (...args: unknown[]) => mocks.generateText(...args),
  };
});

import { printSeasonScreenshot, screenshotSheetSchema } from "./print-season-screenshot.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./print-season-screenshot.mjs", import.meta.url));
const IMAGE_BYTES = Buffer.from("season-screenshot-bytes");
const FILL_WORDS = ["green", "pale blue", "red", "empty red", "yellow", "orange"];

type Io = {
  stdout: { write: (chunk: string) => void };
  stderr: { write: (chunk: string) => void };
  text: () => string;
  err: () => string;
};

function capture(): Io {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout: {
      write(chunk: string) {
        stdout.push(String(chunk));
      },
    },
    stderr: {
      write(chunk: string) {
        stderr.push(String(chunk));
      },
    },
    text: () => stdout.join(""),
    err: () => stderr.join(""),
  };
}

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    NFL_SEASON_YEAR: "2026",
    BOOK_VISION_MODEL_ID: "book/vision",
    COMMENTARY_MODEL_ID: "commentary/should-not-be-used",
    ...overrides,
  };
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...filesUnder(full));
    else found.push(full);
  }
  return found;
}

describe("printSeasonScreenshot", () => {
  let dir = "";

  beforeEach(() => {
    mocks.generateText.mockReset();
    dir = mkdtempSync(join(tmpdir(), "season-shot-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeImage(name: string, bytes: Buffer = IMAGE_BYTES) {
    const filePath = join(dir, name);
    writeFileSync(filePath, bytes);
    return filePath;
  }

  async function run(filePath: string, overrides: Record<string, string | undefined> = {}, now?: Date) {
    const io = capture();
    const code = await printSeasonScreenshot(filePath, {
      env: env(overrides),
      stdout: io.stdout,
      stderr: io.stderr,
      now,
    });
    return { code, io };
  }

  it("prints a past-year grid and does not store spend", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        cells: [{ firstName: "Alex", week: 1, fill: "green", team: "KC" }],
      },
    });
    const filePath = writeImage("2024.png");

    const { code, io } = await run(filePath);

    expect(code).toBe(0);
    expect(io.text()).toBe("first name | week | fill | team\nAlex | 1 | green | KC\n");
    expect(io.err()).toBe("");
    expect(mocks.generateText).toHaveBeenCalledOnce();
    const source = readFileSync(SCRIPT_PATH, "utf8");
    expect(source).not.toMatch(/addCallSpend|prisma|@prisma\/client/);
  });

  it("uses NFL_SEASON_YEAR when it differs from the UTC year", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const current = await run(writeImage("2031.png"), { NFL_SEASON_YEAR: "2031" }, now);

    expect(current.code).not.toBe(0);
    expect(current.io.text()).toBe("");
    expect(current.io.err()).toContain("current season is not a past season");
    expect(mocks.generateText).not.toHaveBeenCalled();

    mocks.generateText.mockResolvedValueOnce({
      output: { cells: [{ firstName: "Alex", week: 1, fill: "green", team: "KC" }] },
    });
    const past = await run(writeImage("2026.png"), { NFL_SEASON_YEAR: "2031" }, now);

    expect(past.code).toBe(0);
    expect(past.io.text()).toBe("first name | week | fill | team\nAlex | 1 | green | KC\n");
    expect(mocks.generateText).toHaveBeenCalledOnce();
  });

  it("uses the UTC year when NFL_SEASON_YEAR is missing or out of range", async () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const filePath = writeImage("2026.png");
    const missing = await run(filePath, { NFL_SEASON_YEAR: undefined }, now);
    const invalid = await run(filePath, { NFL_SEASON_YEAR: "nope" }, now);
    const outOfRange = await run(filePath, { NFL_SEASON_YEAR: "1999" }, now);
    const parsed = await run(filePath, { NFL_SEASON_YEAR: "2026.5" }, now);

    for (const result of [missing, invalid, outOfRange, parsed]) {
      expect(result.code).not.toBe(0);
      expect(result.io.text()).toBe("");
      expect(result.io.err()).toContain("current season is not a past season");
    }
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("rejects a plain CSV before a model call", async () => {
    for (const name of ["2024.csv", "2024.CSV"]) {
      const { code, io } = await run(writeImage(name));
      expect(code).not.toBe(0);
      expect(io.text()).toBe("");
      expect(io.err()).toContain("plain CSV is not a past season");
    }
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("rejects a stem that is not a season year before a model call", async () => {
    const notes = await run(writeImage("notes.png"));
    const tooEarly = await run(writeImage("1999.png"));
    const tooLate = await run(writeImage("2101.png"));

    for (const result of [notes, tooEarly, tooLate]) {
      expect(result.code).not.toBe(0);
      expect(result.io.text()).toBe("");
      expect(result.io.err()).toContain("filename stem must be a season year from 2000 through 2100");
    }
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("rejects a non-image file before a model call", async () => {
    const { code, io } = await run(writeImage("2024.txt"));

    expect(code).not.toBe(0);
    expect(io.text()).toBe("");
    expect(io.err()).toContain("screenshot must be png, jpg, jpeg, or webp");
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("sends only the image bytes and the fixed instruction", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: { cells: [{ firstName: "Alex", week: 1, fill: "green", team: "KC" }] },
    });
    const filePath = writeImage("2024.png");

    await run(filePath);

    expect(mocks.generateText).toHaveBeenCalledOnce();
    const call = mocks.generateText.mock.calls[0][0] as {
      model: string;
      output: { responseFormat: Promise<unknown> };
      messages: Array<{ role: string; content: Array<{ type: string; text?: string; image?: Buffer }> }>;
      tools?: unknown;
      prompt?: unknown;
      system?: unknown;
    };
    expect(call.model).toBe("book/vision");
    expect(call.model).not.toBe("commentary/should-not-be-used");
    expect(call.tools).toBeUndefined();
    expect(call.prompt).toBeUndefined();
    expect(call.system).toBeUndefined();
    expect(await call.output.responseFormat).toEqual(
      await Output.object({ schema: screenshotSheetSchema }).responseFormat,
    );
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe("user");
    const content = call.messages[0].content;
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({
      type: "text",
      text: expect.any(String),
    });
    expect(content[1]).toEqual({ type: "image", image: IMAGE_BYTES });
    const text = content[0].text ?? "";
    expect(text).toContain("first name");
    expect(text).toContain("week");
    expect(text).toContain("fill");
    expect(text).toContain("team");
    for (const word of FILL_WORDS) expect(text).toContain(word);
    expect(text).not.toMatch(/league|member|book|pick|commentary/i);
    expect(JSON.stringify(call.messages)).not.toMatch(/league|member|book|pick|commentary/i);
  });

  it("accepts png, jpg, jpeg, and webp regardless of extension case", async () => {
    for (const name of ["2024.PNG", "2024.jpg", "2024.JPEG", "2024.webp"]) {
      mocks.generateText.mockResolvedValueOnce({ output: { cells: [] } });
      const { code } = await run(writeImage(name));
      expect(code).toBe(0);
    }
    expect(mocks.generateText).toHaveBeenCalledTimes(4);
  });

  it("prints the team text from the cell without a lookup", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        cells: [{ firstName: "Sam", week: 3, fill: "yellow", team: "Buffalo Bills" }],
      },
    });

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).toBe(0);
    expect(io.text()).toBe(
      "first name | week | fill | team\nSam | 3 | yellow | Buffalo Bills\n",
    );
    expect(readFileSync(SCRIPT_PATH, "utf8")).not.toMatch(/abbreviation|prisma/);
  });

  it("prints a red cell with no team as empty red and a blank team", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        cells: [{ firstName: "Alex", week: 2, fill: "red", team: null }],
      },
    });

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).toBe(0);
    expect(io.text()).toBe("first name | week | fill | team\nAlex | 2 | empty red |\n");
    expect(io.err()).toBe("");
  });

  it("keeps red when the cell names a team", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        cells: [{ firstName: "Alex", week: 4, fill: "red", team: "KC" }],
      },
    });

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).toBe(0);
    expect(io.text()).toBe("first name | week | fill | team\nAlex | 4 | red | KC\n");
  });

  it("sorts rows by first name then week", async () => {
    mocks.generateText.mockResolvedValueOnce({
      output: {
        cells: [
          { firstName: "Zoe", week: 1, fill: "pale blue", team: "DAL" },
          { firstName: "Alex", week: 3, fill: "orange", team: "" },
          { firstName: "Alex", week: 1, fill: "green", team: "KC" },
        ],
      },
    });

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).toBe(0);
    expect(io.text()).toBe(
      [
        "first name | week | fill | team",
        "Alex | 1 | green | KC",
        "Alex | 3 | orange |",
        "Zoe | 1 | pale blue | DAL",
        "",
      ].join("\n"),
    );
  });

  it.each([
    {
      label: "duplicate first name and week",
      cells: [
        { firstName: "Alex", week: 1, fill: "green", team: "KC" },
        { firstName: "Alex", week: 1, fill: "yellow", team: "BUF" },
      ],
    },
    {
      label: "a week that is not an integer",
      cells: [{ firstName: "Alex", week: 1.5, fill: "green", team: "KC" }],
    },
    {
      label: "a week that is not a number",
      cells: [{ firstName: "Alex", week: "1", fill: "green", team: "KC" }],
    },
    {
      label: "an unknown fill",
      cells: [{ firstName: "Alex", week: 1, fill: "purple", team: "KC" }],
    },
    {
      label: "a first name containing a pipe",
      cells: [{ firstName: "Al|ex", week: 1, fill: "green", team: "KC" }],
    },
    {
      label: "a first name containing a newline",
      cells: [{ firstName: "Alex\n", week: 1, fill: "green", team: "KC" }],
    },
    {
      label: "a team containing a pipe",
      cells: [{ firstName: "Alex", week: 1, fill: "green", team: "KC|DEN" }],
    },
    {
      label: "a team containing a newline",
      cells: [{ firstName: "Alex", week: 1, fill: "green", team: "KC\nDEN" }],
    },
  ])("prints no grid for $label", async ({ cells }) => {
    mocks.generateText.mockResolvedValueOnce({ output: { cells } });

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).not.toBe(0);
    expect(io.text()).toBe("");
    expect(io.err()).not.toBe("");
    expect(mocks.generateText).toHaveBeenCalledOnce();
  });

  it("prints no grid when the model throws", async () => {
    mocks.generateText.mockRejectedValueOnce(new Error("vision down"));

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).not.toBe(0);
    expect(io.text()).toBe("");
    expect(io.err()).toContain("vision down");
  });

  it.each([
    { label: "null output", result: { output: null, text: "" } },
    { label: "missing output", result: { text: "" } },
    { label: "output without cells", result: { output: {} } },
  ])("prints no grid when the model returns $label", async ({ result }) => {
    mocks.generateText.mockResolvedValueOnce(result);

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).not.toBe(0);
    expect(io.text()).toBe("");
    expect(io.err()).not.toBe("");
  });

  it("rejects a missing model id before a call", async () => {
    const unset = await run(writeImage("2024.png"), { BOOK_VISION_MODEL_ID: undefined });
    const blank = await run(writeImage("2024.png"), { BOOK_VISION_MODEL_ID: "   " });

    for (const result of [unset, blank]) {
      expect(result.code).not.toBe(0);
      expect(result.io.text()).toBe("");
      expect(result.io.err()).toContain("BOOK_VISION_MODEL_ID");
    }
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("prints only the header when the sheet has no cells", async () => {
    mocks.generateText.mockResolvedValueOnce({ output: { cells: [] } });

    const { code, io } = await run(writeImage("2024.png"));

    expect(code).toBe(0);
    expect(io.text()).toBe("first name | week | fill | team\n");
    expect(io.err()).toBe("");
  });

  it("does not import the commentary runner, config, spend, or prisma", () => {
    const source = readFileSync(SCRIPT_PATH, "utf8");
    expect(source).toMatch(/import\s*\{[^}]*\bgenerateText\b[^}]*\}\s*from\s*["']ai["']/);
    expect(source).not.toMatch(
      /prisma|@prisma\/client|run-commentary|commentary-config|spend|@\/lib\/db|runCommentary|readCommentaryConfig|COMMENTARY_MODEL_ID|addCallSpend|writeFile|appendFile|createWriteStream/,
    );
    expect(source).not.toMatch(/src\/app|src\/lib/);
  });

  it("is not imported from app routes or src/lib", () => {
    const roots = [join(process.cwd(), "src/app"), join(process.cwd(), "src/lib")];
    const files = roots.flatMap((root) => filesUnder(root));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("print-season-screenshot");
    }
  });

  it("runs from node and rejects a plain CSV before printing a grid", () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, writeImage("2024.csv")], {
      encoding: "utf8",
      env: {
        ...process.env,
        NFL_SEASON_YEAR: "2026",
        BOOK_VISION_MODEL_ID: "book/vision",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout ?? "").not.toContain("first name");
    expect(result.stderr ?? "").toContain("plain CSV is not a past season");
  });
});
