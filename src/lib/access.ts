import { prisma } from "./db";
import { activeSubscription } from "./plans";
import { moduleAllowed, tierOf, type ModuleKey, type PlanTier } from "./modules";

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

export async function nextInvoiceNumber(userId: string, type: "INVOICE" | "QUOTATION") {
  const prefix = type === "INVOICE" ? "INV" : "QUO";
  const count = await prisma.invoice.count({ where: { userId, type } });
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}