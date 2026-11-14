import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { ModuleHeader, PlanGate } from "@/components/PlanGate";
import { ReferralPanel } from "@/components/ReferralPanel";

export const metadata: Metadata = { title: "Referrals — PicDeck" };
export const instant = false;

export default async function ReferralsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("referrals")) return <PlanGate module="referrals" tier={access.tier} />;

  const [referred, credits] = await Promise.all([
    prisma.user.findMany({
      where: { referredById: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.referralCredit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { source: { select: { name: true } } },
    }),
  ]);

  const total = credits.reduce((sum, credit) => sum + credit.amountInr, 0);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <ModuleHeader
        title="Referral program"
        subtitle={`${credits.length} credited signups · ₹${total.toLocaleString("en-IN")} in credits`}
      />
      <div className="mt-7">
        <ReferralPanel
          code={user.referralCode}
          link={`${appUrl}/register?ref=${user.referralCode}`}
          total={total}
          referred={referred.map((item) => ({
            id: item.id,
            name: item.name,
            email: item.email,
            joinedAt: item.createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          }))}
          credits={credits.map((credit) => ({
            id: credit.id,
            amount: credit.amountInr,
            reason: credit.reason,
            sourceName: credit.source?.name ?? null,
            createdAt: credit.createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          }))}
        />
      </div>
    </div>
  );
}