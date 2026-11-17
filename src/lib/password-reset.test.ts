import { describe, expect, it } from "vitest";
import { isUsablePasswordReset, passwordResetTokenHash } from "./password-reset";

describe("password reset tokens", () => {
  const now = new Date("2026-11-17T00:00:00.000Z");

  it("accepts an unused token that has not expired", () => {
    expect(
      isUsablePasswordReset(
        { expiresAt: new Date("2026-11-17T00:30:00.000Z"), usedAt: null },
        now,
      ),
    ).toBe(true);
  });

  it("rejects expired and previously used tokens", () => {
    expect(
      isUsablePasswordReset(
        { expiresAt: new Date("2026-11-16T23:59:59.000Z"), usedAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      isUsablePasswordReset(
        { expiresAt: new Date("2026-11-17T00:30:00.000Z"), usedAt: now },
        now,
      ),
    ).toBe(false);
  });

  it("hashes the reset token before it is stored", () => {
    expect(passwordResetTokenHash("one-time-link-token")).toMatch(/^[a-f0-9]{64}$/);
  });
});
