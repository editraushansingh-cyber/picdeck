"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireModule } from "@/lib/access";
import { NOTIFICATION_TEMPLATES, renderTemplate, mailtoLink } from "@/lib/notifications";
import type { TemplateKey } from "@/lib/notifications";
import { mailConfigured, sendEmail } from "@/lib/mail";

export async function queueNotification(formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "notifications", "Notifications");
  if (!gate.ok) return gate;

  const template = String(formData.get("template") || "gallery_ready") as TemplateKey;
  const config = NOTIFICATION_TEMPLATES[template];
  if (!config) return { ok: false as const, message: "Unknown template" };

  // Email is the only channel. SMS/WhatsApp were removed from this build.
  const toEmail = String(formData.get("toEmail") || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return { ok: false as const, message: "Enter a valid email address" };
  }

  const values: Record<string, string> = {};
  for (const field of config.fields) {
    values[field] = String(formData.get(`field_${field}`) || "");
  }
  const message = renderTemplate(config.body, values);

  let status = "QUEUED";
  let detail = "Queued";
  if (mailConfigured()) {
    const result = await sendEmail({
      to: toEmail,
      subject: `${config.label} — ${values.event || "PicDeck"}`,
      text: message,
    });
    status = result.sent ? "SENT" : "FAILED";
    detail = result.detail;
  }

  await prisma.notification.create({
    data: {
      userId: user.id,
      eventId: String(formData.get("eventId") || "") || null,
      channel: "email",
      toName: String(formData.get("toName") || "").trim() || null,
      toEmail,
      template,
      message,
      status,
    },
  });

  revalidatePath("/dashboard/notifications");
  return {
    ok: true as const,
    message,
    detail,
    link: mailtoLink(toEmail, config.label, message),
  };
}

export async function markNotificationSent(id: string) {
  const user = await requireUser();
  const item = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!item) return { ok: false as const, message: "Not found" };
  await prisma.notification.update({ where: { id }, data: { status: "SENT" } });
  revalidatePath("/dashboard/notifications");
  return { ok: true as const };
}

export async function deleteNotification(id: string) {
  const user = await requireUser();
  const item = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!item) return { ok: false as const, message: "Not found" };
  await prisma.notification.delete({ where: { id } });
  revalidatePath("/dashboard/notifications");
  return { ok: true as const };
}