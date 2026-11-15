"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireModule } from "@/lib/access";
import { deleteStudioLogo, storeStudioLogo } from "@/lib/storage";
import { ensureStudioCode } from "@/lib/studio";

/** Studio branding: logo + text watermark applied to new client previews. */
export async function saveBranding(formData: FormData) {
  const user = await requireUser();

  const watermarkText = String(formData.get("watermarkText") || "").trim().slice(0, 40) || null;
  let logoPath = user.logoPath;

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const stored = await storeStudioLogo(user.id, logo);
    if ("error" in stored) return { ok: false as const, message: stored.error };
    logoPath = stored.relative;
  } else if (formData.get("removeLogo") === "on") {
    await deleteStudioLogo(user.id);
    logoPath = null;
  }

  const website = String(formData.get("website") || "").trim().slice(0, 80) || null;
  const upiId = String(formData.get("upiId") || "").trim().slice(0, 60) || null;
  const bankAccount = String(formData.get("bankAccount") || "").trim().slice(0, 40) || null;
  const ifsc = String(formData.get("ifsc") || "").trim().toUpperCase().slice(0, 15) || null;

  // Invoice numbering prefix: 2–3 letters, no digits-only (a year already follows it).
  const rawPrefix = String(formData.get("invoicePrefix") || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const invoicePrefix = rawPrefix ? rawPrefix.slice(0, 3) : null;

  // Studio-wide default terms, one line per entry, printed on every invoice
  // that does not override them.
  const invoiceTerms = String(formData.get("invoiceTerms") || "")
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 200))
    .filter((line) => line.length > 0)
    .slice(0, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      watermarkText,
      logoPath,
      website,
      upiId,
      bankAccount,
      ifsc,
      invoicePrefix,
      invoiceTerms: JSON.stringify(invoiceTerms),
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard/invoices");
  return { ok: true as const };
}

export async function saveCustomDomain(formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "website", "A custom domain");
  if (!gate.ok) return { ok: false as const, message: gate.message };

  const site = await prisma.studioSite.findUnique({ where: { userId: user.id } });
  if (!site) return { ok: false as const, message: "Create your studio site first" };

  const raw = String(formData.get("customDomain") || "").trim().toLowerCase();
  if (!raw) {
    await prisma.studioSite.update({ where: { id: site.id }, data: { customDomain: null } });
    revalidatePath("/dashboard/settings");
    return { ok: true as const, domain: null };
  }

  const domain = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { ok: false as const, message: "Use a domain like studio.example.com" };
  }

  const clash = await prisma.studioSite.findUnique({ where: { customDomain: domain } });
  if (clash && clash.userId !== user.id) {
    return { ok: false as const, message: "That domain is already connected" };
  }

  await prisma.studioSite.update({ where: { id: site.id }, data: { customDomain: domain } });
  revalidatePath("/dashboard/settings");
  return { ok: true as const, domain };
}

/** Lazily creates the studio code used by the all-events QR. */
export async function ensureStudioCodeAction() {
  const user = await requireUser();
  const code = await ensureStudioCode(user.id);
  revalidatePath("/dashboard/settings");
  return { ok: true as const, code };
}
