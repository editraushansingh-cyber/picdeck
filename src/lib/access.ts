import { prisma } from "./db";
import { activeSubscription } from "./plans";
import { moduleAllowed, tierOf, type ModuleKey, type PlanTier } from "./modules";
import { formatInvoiceNumber } from "./invoices";

export type Access = {
  planSlug: string | null;
  tier: PlanTier;
  can: (module: ModuleKey) => boolean;
};

/** Resolves what the signed-in studio can use, from one subscription lookup. */
export async function accessFor(userId: string): Promise<Access> {
  const subscription = await activeSubscription(userId);
  const planSlug = subscription?.plan.slug ?? null;
  return {
    planSlug,
    tier: tierOf(planSlug),
    can: (module: ModuleKey) => moduleAllowed(module, planSlug),
  };
}

/** Used by server actions: throws a readable error the client can show. */
export async function requireModule(userId: string, module: ModuleKey, label: string) {
  const access = await accessFor(userId);
  if (!access.can(module)) {
    return {
      ok: false as const,
      message: `${label} needs a higher plan. You are on ${access.tier}.`,
    };
  }
  return { ok: true as const, access };
}

export async function nextInvoiceNumber(userId: string) {
  const year = new Date().getFullYear();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { invoicePrefix: true },
  });

  // One document register per studio per year: quotations and invoices draw
  // from the same counter, so a number is never reused across document types.
  const yearStart = new Date(year, 0, 1);
  const used = await prisma.invoice.count({
    where: { userId, createdAt: { gte: yearStart } },
  });

  const build = (sequence: number) =>
    formatInvoiceNumber({ prefix: user?.invoicePrefix ?? null, year, sequence });

  // Hand-edited numbers can collide; walk forward until the row is free.
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = build(used + 1 + attempt);
    const clash = await prisma.invoice.findUnique({
      where: { number: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return build(used + 51);
}