import { prisma } from "./db";
import { randomSlug } from "./face";

/** Returns (and lazily creates) the studio share code used by the all-events QR. */
export async function ensureStudioCode(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studioCode: true },
  });
  if (user?.studioCode) return user.studioCode;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomSlug(8);
    const clash = await prisma.user.findUnique({ where: { studioCode: code } });
    if (clash) continue;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { studioCode: code },
      select: { studioCode: true },
    });
    return updated.studioCode!;
  }
  throw new Error("Could not allocate a studio code");
}

/** Studio-level branding used when rendering previews. */
export async function brandingFor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { logoPath: true, watermarkText: true, name: true },
  });
  return {
    logoPath: user?.logoPath ?? null,
    text: user?.watermarkText?.trim() || null,
    name: user?.name ?? "Studio",
  };
}

/** Public studio page payload: every published event/album under one code. */
export async function studioByCode(code: string) {
  const user = await prisma.user.findUnique({
    where: { studioCode: code },
    select: {
      id: true,
      name: true,
      city: true,
      studioSite: { select: { slug: true, headline: true, coverPath: true, published: true } },
      events: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          eventDate: true,
          clientName: true,
          galleryCode: true,
          albums: {
            where: { published: true },
            orderBy: { createdAt: "desc" },
            select: { id: true, slug: true, title: true, coverPath: true, coverPhotoId: true },
          },
        },
      },
    },
  });
  return user;
}
