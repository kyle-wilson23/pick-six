import { describe, expect, it } from "vitest";

import { createAccountBodySchema } from "@/lib/create-account";
import { SIGNUP_PASSWORD_POLICY_MESSAGE } from "@/lib/invitations";

describe("createAccountBodySchema", () => {
  it("accepts valid email, names, and password meeting signup policy", () => {
    const parsed = createAccountBodySchema.safeParse({
      email: "  Tester@Example.com  ",
      password: "Secret1!",
      firstName: "  Ada  ",
      lastName: " Lovelace ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("Tester@Example.com");
      expect(parsed.data.password).toBe("Secret1!");
      expect(parsed.data.firstName).toBe("Ada");
      expect(parsed.data.lastName).toBe("Lovelace");
    }
  });

  it("rejects invalid email", () => {
    const parsed = createAccountBodySchema.safeParse({
      email: "not-an-email",
      password: "Secret1!",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["email"]);
    }
  });

  it("rejects weak password with signup policy message", () => {
    const parsed = createAccountBodySchema.safeParse({
      email: "test@example.com",
      password: "short",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const passwordIssue = parsed.error.issues.find((i) => i.path[0] === "password");
      expect(passwordIssue?.message).toBe(SIGNUP_PASSWORD_POLICY_MESSAGE);
    }
  });

  it("rejects blank first or last name", () => {
    const missingFirst = createAccountBodySchema.safeParse({
      email: "test@example.com",
      password: "Secret1!",
      firstName: "  ",
      lastName: "Lovelace",
    });
    expect(missingFirst.success).toBe(false);
    if (!missingFirst.success) {
      expect(missingFirst.error.issues[0]?.path).toEqual(["firstName"]);
    }

    const missingLast = createAccountBodySchema.safeParse({
      email: "test@example.com",
      password: "Secret1!",
      firstName: "Ada",
      lastName: "",
    });
    expect(missingLast.success).toBe(false);
    if (!missingLast.success) {
      expect(missingLast.error.issues[0]?.path).toEqual(["lastName"]);
    }
  });
});
