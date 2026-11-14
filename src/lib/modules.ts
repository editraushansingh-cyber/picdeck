export type PlanTier =
  | "free"
  | "basic"
  | "silver"
  | "gold"
  | "all-access"
  | "album-basic"
  | "album-premium"
  | "album-platinum"
  | "ai-basic"
  | "ai-silver"
  | "ai-gold";

export const PLAN_ORDER: PlanTier[] = [
  "free",
  "basic",
  "silver",
  "gold",
  "all-access",
  "album-basic",
  "album-premium",
  "album-platinum",
  "ai-basic",
  "ai-silver",
  "ai-gold",
];

export const TIER_LABELS: Record<PlanTier, string> = {
  free: "Free",
  basic: "Basic",
  silver: "Silver",
  gold: "Gold",
  "all-access": "All-Access",
  "album-basic": "Album Basic",
  "album-premium": "Album Premium",
  "album-platinum": "Album Platinum",
  "ai-basic": "AI Basic",
  "ai-silver": "AI Silver",
  "ai-gold": "AI Gold",
};

export type ModuleKey =
  | "selection"
  | "download"
  | "faces"
  | "album"
  | "invoices"
  | "invitations"
  | "website"
  | "notifications"
  | "referrals";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  selection: "Photo Selection",
  download: "Client downloads",
  faces: "AI face search",
  album: "Album / flipbook",
  invoices: "Invoices & quotations",
  invitations: "Invitation templates",
  website: "Studio website",
  notifications: "Notification queue",
  referrals: "Referral program",
};

/**
 * The delivery suite (selection, invoices, invitations, website, reminders) is
 * part of every plan — free included — because those modules are what makes the
 * product useful on day one. Album and face search are sold separately, matching
 * how the reference product packages them.
 */
const CORE: ModuleKey[] = [
  "selection",
  "download",
  "invoices",
  "invitations",
  "website",
  "notifications",
  "referrals",
];

const WITH_ALBUM: ModuleKey[] = [...CORE, "album"];
const WITH_FACES: ModuleKey[] = [...CORE, "faces"];
const EVERYTHING: ModuleKey[] = [...CORE, "album", "faces"];

export const MODULES_BY_TIER: Record<PlanTier, ModuleKey[]> = {
  free: CORE,
  basic: CORE,
  silver: EVERYTHING,
  gold: EVERYTHING,
  "all-access": EVERYTHING,
  "album-basic": WITH_ALBUM,
  "album-premium": WITH_ALBUM,
  "album-platinum": WITH_ALBUM,
  "ai-basic": WITH_FACES,
  "ai-silver": WITH_FACES,
  "ai-gold": WITH_FACES,
};

/** Cheapest tier that unlocks each add-on module — used by the upsell card. */
export const UPGRADE_TIER: Record<ModuleKey, PlanTier> = {
  selection: "free",
  download: "free",
  faces: "ai-basic",
  album: "album-basic",
  invoices: "free",
  invitations: "free",
  website: "free",
  notifications: "free",
  referrals: "free",
};

export const INVITATION_LIMIT: Record<PlanTier, number> = {
  free: 2,
  basic: 2,
  silver: 25,
  gold: 200,
  "all-access": 200,
  "album-basic": 2,
  "album-premium": 2,
  "album-platinum": 25,
  "ai-basic": 2,
  "ai-silver": 25,
  "ai-gold": 200,
};

/** Active events allowed at once; null means unlimited. */
export const EVENT_LIMIT: Record<PlanTier, number | null> = {
  free: 1,
  basic: null,
  silver: null,
  gold: null,
  "all-access": null,
  "album-basic": null,
  "album-premium": null,
  "album-platinum": null,
  "ai-basic": null,
  "ai-silver": null,
  "ai-gold": null,
};

export function tierOf(planSlug: string | null | undefined): PlanTier {
  if (!planSlug) return "free";
  if (planSlug.startsWith("all-access")) return "all-access";
  if (planSlug.startsWith("album-basic")) return "album-basic";
  if (planSlug.startsWith("album-premium")) return "album-premium";
  if (planSlug.startsWith("album-platinum")) return "album-platinum";
  if (planSlug.startsWith("ai-basic")) return "ai-basic";
  if (planSlug.startsWith("ai-silver")) return "ai-silver";
  if (planSlug.startsWith("ai-gold")) return "ai-gold";
  if (planSlug.startsWith("gold")) return "gold";
  if (planSlug.startsWith("silver")) return "silver";
  if (planSlug.startsWith("basic")) return "basic";
  if (planSlug.startsWith("free")) return "free";
  return "free";
}

export function moduleAllowed(
  module: ModuleKey,
  planSlug: string | null | undefined,
): boolean {
  return MODULES_BY_TIER[tierOf(planSlug)].includes(module);
}
