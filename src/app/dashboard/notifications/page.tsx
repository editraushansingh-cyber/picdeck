import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { mailConfigured } from "@/lib/mail";
import { ModuleHeader, PlanGate } from "@/components/PlanGate";
import { NotificationComposer, type NotificationRowData } from "@/components/NotificationPanels";

export const metadata: Metadata = { title: "Notifications — PicDeck" };
export const instant = false;

export default async function NotificationsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("notifications")) return <PlanGate module="notifications" tier={access.tier} />;

  const [notifications, events] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.event.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, clientName: true, clientPhone: true, clientEmail: true },
    }),
  ]);

  const rows: NotificationRowData[] = notifications.map((item) => ({
    id: item.id,
    toName: item.toName,
    toEmail: item.toEmail,
    template: item.template,
    message: item.message,
    status: item.status,
    createdAt: item.createdAt.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
  }));

  const queued = notifications.filter((item) => item.status === "QUEUED").length;

  return (
    <div>
      <ModuleHeader
        title="Client notifications"
        subtitle={`${queued} queued · ${notifications.length} total · email`}
      />
      <div className="mt-7">
        <NotificationComposer
          mailReady={mailConfigured()}
          templates={Object.entries(NOTIFICATION_TEMPLATES).map(([key, value]) => ({
            key,
            label: value.label,
            body: value.body,
            fields: value.fields,
          }))}
          events={events}
          notifications={rows}
        />
      </div>
    </div>
  );
}