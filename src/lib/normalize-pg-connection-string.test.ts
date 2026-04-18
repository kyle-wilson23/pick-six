import { describe, expect, it } from "vitest";

import { normalizePgConnectionString } from "./normalize-pg-connection-string";

describe("normalizePgConnectionString", () => {
  it("rewrites sslmode=require to verify-full", () => {
    expect(
      normalizePgConnectionString("postgresql://u:p@host/db?sslmode=require"),
    ).toBe("postgresql://u:p@host/db?sslmode=verify-full");
  });

  it("rewrites sslmode=prefer and verify-ca", () => {
    expect(normalizePgConnectionString("postgres://h/db?sslmode=prefer")).toBe(
      "postgres://h/db?sslmode=verify-full",
    );
    expect(normalizePgConnectionString("postgresql://h/db?sslmode=verify-ca")).toBe(
      "postgresql://h/db?sslmode=verify-full",
    );
  });

  it("leaves other ssl modes and strings unchanged", () => {
    const u = "postgresql://h/db?sslmode=verify-full";
    expect(normalizePgConnectionString(u)).toBe(u);
    expect(normalizePgConnectionString("postgresql://h/db")).toBe("postgresql://h/db");
    expect(normalizePgConnectionString("not a url")).toBe("not a url");
  });
});
