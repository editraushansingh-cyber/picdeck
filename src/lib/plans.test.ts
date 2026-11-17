import { describe, expect, it } from "vitest";
import { isSubscriptionActive } from "./plans";

describe("isSubscriptionActive", () => {
  const now = new Date("2026-11-17T00:00:00.000Z");

  it("keeps an ongoing Free subscription active without an end date", () => {
    expect(isSubscriptionActive({ endsAt: null }, now)).toBe(true);
  });

  it("does not reactivate an expired dated subscription", () => {
    expect(isSubscriptionActive({ endsAt: new Date("2026-11-16T23:59:59.000Z") }, now)).toBe(false);
  });
});
