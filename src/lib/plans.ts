export type PlanGroup = "photo" | "all-access" | "album" | "ai";

export type PlanFeature = string;

export type PlanSeed = {
  slug: string;
  name: string;
  group: PlanGroup;
  priceInr: number;
  periodMonths: number;
  highlight?: string;
  features: PlanFeature[];
  sortOrder: number;
};

/**
 * Photo Selection plans, mirroring the observed price points.
 *
 * The suite is sold four ways, the same shape the reference product uses:
 *   photo       — selection galleries, invoices, invitations, studio site
 *   all-access  — every module in one subscription
 *   album       — flipbook/album packs for studios that only need delivery
 *   ai          — face search packs for high-volume candid teams
 */
export const PHOTO_SELECTION_PLANS: PlanSeed[] = [
  {
    slug: "basic-monthly",
    name: "Basic",
    group: "photo",
    priceInr: 249,
    periodMonths: 1,
    highlight: "Monthly",
    features: [
      "Unlimited customer galleries",
      "Unlimited photo upload",
      "High-speed upload & download",
      "RAW file support",
      "Client compressed download",
      "Download permission on / off",
      "One-click selected download",
      "Invoices & quotations",
      "Studio website",
      "2 invitation templates",
      "Referral credits",
    ],
    sortOrder: 1,
  },
  {
    slug: "silver-half-yearly",
    name: "Silver",
    group: "photo",
    priceInr: 899,
    periodMonths: 6,
    highlight: "Half-yearly",
    features: [
      "Everything in Basic",
      "Unlimited photo upload",
      "One-click folder download",
      "Original download permission",
      "AI face search",
      "Album / flipbook",
      "25 invitation templates",
      "Priority support",
    ],
    sortOrder: 2,
  },
  {
    slug: "gold-yearly",
    name: "Gold",
    group: "photo",
    priceInr: 1399,
    periodMonths: 12,
    highlight: "Best value",
    features: [
      "Everything in Silver",
      "Unlimited events for a year",
      "AI face search with named groups",
      "Album / flipbook with music",
      "200 invitation templates",
      "Client notification queue",
      "Custom studio branding & watermark",
      "Priority support",
    ],
    sortOrder: 3,
  },
];

export const FREE_PLAN: PlanSeed = {
  slug: "free",
  name: "Free",
  group: "photo",
  priceInr: 0,
  periodMonths: 12,
  features: [
    "1 active event at a time",
    "Photo selection with 6-digit codes",
    "Compressed client download",
    "Invoices, invitations & studio site",
    "Referral credits",
    "Watermarked client previews",
  ],
  sortOrder: 0,
};

export const ALL_ACCESS_PLAN: PlanSeed = {
  slug: "all-access-yearly",
  name: "All-Access",
  group: "all-access",
  priceInr: 1999,
  periodMonths: 12,
  highlight: "Everything, one price",
  features: [
    "Every photo module, no add-ons",
    "AI face search with named groups",
    "Albums / flipbooks with music & QR",
    "Invoices, quotations & invitations",
    "Studio website + custom domain",
    "Notification queue (email)",
    "Custom logo, watermark & backgrounds",
    "Priority support",
  ],
  sortOrder: 4,
};

export const ALBUM_PLANS: PlanSeed[] = [
  {
    slug: "album-basic-yearly",
    name: "Album Basic",
    group: "album",
    priceInr: 599,
    periodMonths: 12,
    features: [
      "Unlimited flipbooks",
      "Spread editor with captions",
      "Client gallery + downloads",
      "Lifetime QR per album",
    ],
    sortOrder: 5,
  },
  {
    slug: "album-premium-yearly",
    name: "Album Premium",
    group: "album",
    priceInr: 1199,
    periodMonths: 12,
    highlight: "Popular add-on",
    features: [
      "Everything in Album Basic",
      "Cover art & background music",
      "Studio logo on every cover",
      "All-events studio QR",
    ],
    sortOrder: 6,
  },
  {
    slug: "album-platinum-yearly",
    name: "Album Platinum",
    group: "album",
    priceInr: 1799,
    periodMonths: 12,
    features: [
      "Everything in Album Premium",
      "Custom logo & watermark",
      "Background library",
      "Priority album support",
    ],
    sortOrder: 7,
  },
];

export const AI_PLANS: PlanSeed[] = [
  {
    slug: "ai-basic-yearly",
    name: "AI Basic",
    group: "ai",
    priceInr: 499,
    periodMonths: 12,
    features: [
      "Selfie face search",
      "1,000 indexed photos",
      "Client gallery integration",
      "Compressed download",
    ],
    sortOrder: 8,
  },
  {
    slug: "ai-silver-yearly",
    name: "AI Silver",
    group: "ai",
    priceInr: 899,
    periodMonths: 12,
    highlight: "Most picked",
    features: [
      "Everything in AI Basic",
      "5,000 indexed photos",
      "Auto-tagged person groups",
      "Name-based client search",
    ],
    sortOrder: 9,
  },
  {
    slug: "ai-gold-yearly",
    name: "AI Gold",
    group: "ai",
    priceInr: 1199,
    periodMonths: 12,
    features: [
      "Everything in AI Silver",
      "Unlimited indexed photos",
      "All-events studio QR",
      "Priority support",
    ],
    sortOrder: 10,
  },
];

export const ALL_PLANS: PlanSeed[] = [
  FREE_PLAN,
  ...PHOTO_SELECTION_PLANS,
  ALL_ACCESS_PLAN,
  ...ALBUM_PLANS,
  ...AI_PLANS,
];

export const PLAN_GROUP_LABELS: Record<PlanGroup, string> = {
  photo: "Photo Selection",
  "all-access": "All-Access",
  album: "Album add-on",
  ai: "AI add-on",
};

export function planBySlug(slug: string) {
  return ALL_PLANS.find((plan) => plan.slug === slug) ?? null;
}

export const TRIAL_DAYS = 14;

/** Returns the user's active Photo Selection subscription (paid or trial), or null. */
export async function activeSubscription(userId: string) {
  const { prisma } = await import("./db");
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIAL"] },
      endsAt: { gt: new Date() },
    },
    include: { plan: true },
    orderBy: { endsAt: "desc" },
  });
}
