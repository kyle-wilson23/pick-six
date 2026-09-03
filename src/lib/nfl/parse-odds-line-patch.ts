import { z } from "zod";

import { validateManualMoneylines } from "@/lib/domain/odds-format";

const patchSchema = z.object({
  homeMoneylineAmerican: z.number().nullable(),
  awayMoneylineAmerican: z.number().nullable(),
  homeSpreadPoints: z.number().nullable(),
});

export function parseOddsLinePatchBody(
  value: unknown,
):
  | { ok: true; data: z.infer<typeof patchSchema> }
  | { ok: false; error: { code: string; message: string } } {
  const parsed = patchSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: first?.message ?? "Invalid request body" },
    };
  }
  const moneylineCheck = validateManualMoneylines(
    parsed.data.homeMoneylineAmerican,
    parsed.data.awayMoneylineAmerican,
  );
  if (!moneylineCheck.ok) {
    return { ok: false, error: { code: moneylineCheck.code, message: moneylineCheck.message } };
  }
  return { ok: true, data: parsed.data };
}
