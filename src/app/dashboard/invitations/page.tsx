import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { INVITATION_LIMIT } from "@/lib/modules";
import { ModuleHeader, PlanGate } from "@/components/PlanGate";
import { InvitationStudio, type InviteRowData } from "@/components/InvitationStudio";

export const metadata: Metadata = { title: "Invitations — PicDeck" };
export const instant = false;

export default async function InvitationsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("invitations")) return <PlanGate module="invitations" tier={access.tier} />;

  const invites = await prisma.invitation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const limit = INVITATION_LIMIT[access.tier];

  const rows: InviteRowData[] = invites.map((invite) => ({
    id: invite.id,
    slug: invite.slug,
    template: invite.template,
    couple: `${invite.coupleA} & ${invite.coupleB}`,
    date: invite.eventDate
      ? invite.eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : null,
    venue: invite.venue,
    rsvpCount: invite.rsvpCount,
    published: invite.published,
    url: `${appUrl}/invite/${invite.slug}`,
  }));

  return (
    <div>
      <ModuleHeader
        title="Invitations"
        subtitle={`${invites.length} of ${limit} used on ${access.tier} · four templates, one share link each`}
      />
      <div className="mt-7">
        <InvitationStudio invites={rows} remaining={Math.max(0, limit - invites.length)} />
      </div>
    </div>
  );
}