import { describe, expect, it } from "vitest";
import {
  EVENT_LIMIT,
  INVITATION_LIMIT,
  MODULES_BY_TIER,
  MODULE_LABELS,
  tierOf,
  moduleAllowed,
  type ModuleKey,
} from "./modules";
import { ALL_PLANS, planBySlug } from "./plans";

const ALL_MODULES = Object.keys(MODULE_LABELS) as ModuleKey[];

describe("tierOf", () => {
  it("maps photo plan slugs to tiers", () => {
    expect(tierOf("basic-monthly")).toBe("basic");
    expect(tierOf("silver-half-yearly")).toBe("silver");
    expect(tierOf("gold-yearly")).toBe("gold");
  });

  it("maps bundle and add-on slugs", () => {
    expect(tierOf("free")).toBe("free");
    expect(tierOf("all-access-yearly")).toBe("all-access");
    expect(tierOf("album-basic-yearly")).toBe("album-basic");
    expect(tierOf("album-premium-yearly")).toBe("album-premium");
    expect(tierOf("album-platinum-yearly")).toBe("album-platinum");
    expect(tierOf("ai-basic-yearly")).toBe("ai-basic");
    expect(tierOf("ai-silver-yearly")).toBe("ai-silver");
    expect(tierOf("ai-gold-yearly")).toBe("ai-gold");
  });

  it("falls back to free for unknown or missing plans", () => {
    expect(tierOf(null)).toBe("free");
    expect(tierOf(undefined)).toBe("free");
    expect(tierOf("enterprise")).toBe("free");
  });
});

describe("moduleAllowed", () => {
  it("gives the free plan the delivery suite but not album or faces", () => {
    expect(moduleAllowed("selection", null)).toBe(true);
    expect(moduleAllowed("download", null)).toBe(true);
    expect(moduleAllowed("invoices", null)).toBe(true);
    expect(moduleAllowed("invitations", null)).toBe(true);
    expect(moduleAllowed("website", null)).toBe(true);
    expect(moduleAllowed("notifications", null)).toBe(true);
    expect(moduleAllowed("referrals", null)).toBe(true);
    expect(moduleAllowed("faces", null)).toBe(false);
    expect(moduleAllowed("album", null)).toBe(false);
  });

  it("keeps the delivery suite in every paid photo plan", () => {
    for (const slug of ["basic-monthly", "silver-half-yearly", "gold-yearly"]) {
      expect(moduleAllowed("invoices", slug)).toBe(true);
      expect(moduleAllowed("website", slug)).toBe(true);
      expect(moduleAllowed("notifications", slug)).toBe(true);
    }
  });

  it("unlocks album and faces on Silver, and everything on Gold", () => {
    expect(moduleAllowed("album", "basic-monthly")).toBe(false);
    expect(moduleAllowed("faces", "basic-monthly")).toBe(false);
    expect(moduleAllowed("album", "silver-half-yearly")).toBe(true);
    expect(moduleAllowed("faces", "silver-half-yearly")).toBe(true);
    for (const key of ALL_MODULES) {
      expect(moduleAllowed(key, "gold-yearly")).toBe(true);
    }
  });

  it("unlocks every module on All-Access", () => {
    for (const key of ALL_MODULES) {
      expect(moduleAllowed(key, "all-access-yearly")).toBe(true);
    }
  });

  it("sells album and AI separately", () => {
    expect(moduleAllowed("album", "album-basic-yearly")).toBe(true);
    expect(moduleAllowed("faces", "album-basic-yearly")).toBe(false);
    expect(moduleAllowed("faces", "ai-basic-yearly")).toBe(true);
    expect(moduleAllowed("album", "ai-basic-yearly")).toBe(false);
    expect(moduleAllowed("selection", "ai-gold-yearly")).toBe(true);
  });

  it("defines at least one tier for every module", () => {
    for (const key of ALL_MODULES) {
      const tiers = Object.values(MODULES_BY_TIER).filter((modules) => modules.includes(key));
      expect(tiers.length).toBeGreaterThan(0);
    }
  });
});

describe("plan catalogue", () => {
  it("includes free, all-access, album and AI products", () => {
    const groups = new Set(ALL_PLANS.map((plan) => plan.group));
    expect(groups).toEqual(new Set(["photo", "all-access", "album", "ai"]));
    expect(planBySlug("free")?.priceInr).toBe(0);
    expect(planBySlug("all-access-yearly")?.priceInr).toBe(1999);
  });

  it("has unique slugs", () => {
    const slugs = ALL_PLANS.map((plan) => plan.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("raises the invitation allowance with the tier", () => {
    expect(INVITATION_LIMIT.free).toBeLessThan(INVITATION_LIMIT.silver);
    expect(INVITATION_LIMIT.silver).toBeLessThan(INVITATION_LIMIT.gold);
    expect(INVITATION_LIMIT["all-access"]).toBe(INVITATION_LIMIT.gold);
  });

  it("limits only the free plan to a single active event", () => {
    expect(EVENT_LIMIT.free).toBe(1);
    expect(EVENT_LIMIT.basic).toBeNull();
    expect(EVENT_LIMIT["all-access"]).toBeNull();
  });
});
