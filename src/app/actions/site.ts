"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireModule } from "@/lib/access";
import { isInviteTemplate } from "@/lib/invitations";
import { deleteSiteCover, storeSiteCover } from "@/lib/storage";
import { randomSlug } from "@/lib/face";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Creates or updates the studio's public site. Gold plan only. */
export async function saveStudioSite(formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "website", "The studio website");
  if (!gate.ok) return { ok: false as const, message: gate.message };

  const headline = String(formData.get("headline") || "").trim();
  if (headline.length < 4) return { ok: false as const, message: "Add a headline" };

  const desired = slugify(String(formData.get("slug") || "")) || slugify(user.name);
  if (desired.length < 3) return { ok: false as const, message: "Pick a longer site address" };

  const clash = await prisma.studioSite.findUnique({ where: { slug: desired } });
  if (clash && clash.userId !== user.id) {
    return { ok: false as const, message: "That address is taken. Try another." };
  }

  const services = formData
    .getAll("service_title")
    .map((title, index) => ({
      title: String(title).trim(),
      price: String(formData.getAll("service_price")[index] || "").trim(),
      description: String(formData.getAll("service_description")[index] || "").trim(),
    }))
    .filter((service) => service.title);

  const existing = await prisma.studioSite.findUnique({ where: { userId: user.id } });

  // Optional cover upload: replace, keep, or remove.
  let coverPath = existing?.coverPath ?? null;
  const cover = formData.get("cover");
  const removeCover = formData.get("removeCover") === "on";
  if (cover instanceof File && cover.size > 0) {
    const stored = await storeSiteCover(user.id, cover);
    if ("error" in stored) return { ok: false as const, message: stored.error };
    coverPath = stored.relative;
  } else if (removeCover) {
    await deleteSiteCover(user.id);
    coverPath = null;
  }

  const data = {
    slug: desired,
    headline,
    about: String(formData.get("about") || "").trim() || null,
    services: JSON.stringify(services),
    whatsapp: String(formData.get("whatsapp") || "").trim() || null,
    instagram: String(formData.get("instagram") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    coverPath,
    published: formData.get("published") === "on",
  };

  const site = await prisma.studioSite.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  revalidatePath("/dashboard/website");
  revalidatePath(`/s/${site.slug}`);
  return { ok: true as const, slug: site.slug };
}

export async function toggleSitePublished() {
  const user = await requireUser();
  const site = await prisma.studioSite.findUnique({ where: { userId: user.id } });
  if (!site) return { ok: false as const, message: "Create the site first" };
  await prisma.studioSite.update({
    where: { userId: user.id },
    data: { published: !site.published },
  });
  revalidatePath("/dashboard/website");
  revalidatePath(`/s/${site.slug}`);
  return { ok: true as const };
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function saveInvitation(formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "invitations", "Invitations");
  if (!gate.ok) return gate;

  const coupleA = String(formData.get("coupleA") || "").trim();
  const coupleB = String(formData.get("coupleB") || "").trim();
  if (!coupleA || !coupleB) return { ok: false as const, message: "Add both names" };

  const template = String(formData.get("template") || "ivory");
  const safeTemplate = isInviteTemplate(template) ? template : "ivory";
  const dateRaw = String(formData.get("eventDate") || "");

  const invite = await prisma.invitation.create({
    data: {
      userId: user.id,
      slug: randomSlug(8),
      template: safeTemplate,
      coupleA,
      coupleB,
      eventDate: dateRaw ? new Date(dateRaw) : null,
      venue: String(formData.get("venue") || "").trim() || null,
      message: String(formData.get("message") || "").trim() || null,
    },
  });

  revalidatePath("/dashboard/invitations");
  return { ok: true as const, slug: invite.slug };
}

export async function toggleInvitationPublished(id: string) {
  const user = await requireUser();
  const invite = await prisma.invitation.findFirst({ where: { id, userId: user.id } });
  if (!invite) return { ok: false as const, message: "Invitation not found" };
  await prisma.invitation.update({
    where: { id },
    data: { published: !invite.published },
  });
  revalidatePath("/dashboard/invitations");
  revalidatePath(`/invite/${invite.slug}`);
  return { ok: true as const, published: !invite.published };
}

export async function deleteInvitation(id: string) {
  const user = await requireUser();
  const invite = await prisma.invitation.findFirst({ where: { id, userId: user.id } });
  if (!invite) return { ok: false as const, message: "Invitation not found" };
  await prisma.invitation.delete({ where: { id } });
  revalidatePath("/dashboard/invitations");
  return { ok: true as const };
}

export async function rsvpToInvitation(slug: string) {
  const invite = await prisma.invitation.findUnique({ where: { slug } });
  if (!invite) return { ok: false as const, message: "Invitation not found" };
  await prisma.invitation.update({ where: { slug }, data: { rsvpCount: { increment: 1 } } });
  revalidatePath(`/invite/${slug}`);
  return { ok: true as const, count: invite.rsvpCount + 1 };
}