import { describe, expect, it } from "vitest";

import { createAccountBodySchema } from "@/lib/create-account";
import { SIGNUP_PASSWORD_POLICY_MESSAGE } from "@/lib/invitations";

describe("createAccountBodySchema", () => {
  it("accepts valid email and password meeting signup policy", () => {
    const parsed = createAccountBodySchema.safeParse({
      email: "  Tester@Example.com  ",
      password: "Secret1!",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("Tester@Example.com");
      expect(parsed.data.password).toBe("Secret1!");
    }
  });

  it("rejects invalid email", () => {
    const parsed = createAccountBodySchema.safeParse({
      email: "not-an-email",
      password: "Secret1!",
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
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const passwordIssue = parsed.error.issues.find((i) => i.path[0] === "password");
      expect(passwordIssue?.message).toBe(SIGNUP_PASSWORD_POLICY_MESSAGE);
    }
  });
});
