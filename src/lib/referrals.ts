import { prisma } from "./db";

/**
 * Credits the referring studio once per invited signup. Kept as a plain library
 * function (not a server action) so it cannot be called from the browser.
 */
export async function grantReferralCredit(referrerId: string, newUserId: string) {
  const existing = await prisma.referralCredit.findFirst({
    where: { userId: referrerId, sourceId: newUserId },
  });
  if (existing) return;

  await prisma.referralCredit.create({
    data: {
      userId: referrerId,
      sourceId: newUserId,
      amountInr: 200,
      reason: "signup",
    },
  });
}