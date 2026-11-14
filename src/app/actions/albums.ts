"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { accessFor, requireModule } from "@/lib/access";
import { randomSlug } from "@/lib/face";
import {
  clearAlbumMusic,
  deleteAlbumFiles,
  storeAlbumCover,
  storeAlbumMusic,
} from "@/lib/storage";
import { renameFaceGroup } from "@/lib/face-tags";

async function uniqueSlug(check: (slug: string) => Promise<boolean>) {
  for (let i = 0; i < 20; i += 1) {
    const slug = randomSlug(9);
    if (!(await check(slug))) return slug;
  }
  return randomSlug(14);
}

/** Builds a page-turning album from the client's selection (or every photo). */
export async function createAlbum(eventId: string, formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "album", "Albums");
  if (!gate.ok) return gate;

  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
    include: {
      photos: { orderBy: { createdAt: "asc" } },
      selections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!event) return { ok: false as const, message: "Event not found" };

  const selectedIds = event.selections.map((s) => s.photoId);
  const source =
    formData.get("source") === "all"
      ? event.photos
      : event.photos.filter((photo) => selectedIds.includes(photo.id));

  if (source.length === 0) {
    return {
      ok: false as const,
      message:
        formData.get("source") === "all"
          ? "Upload photos first"
          : "The client has not picked any photos yet. Choose “all photos” or wait for their list.",
    };
  }

  const title = String(formData.get("title") || event.title).trim() || event.title;
  const subtitle = String(formData.get("subtitle") || "").trim() || null;
  const slug = await uniqueSlug(async (candidate) => !!(await prisma.album.findUnique({ where: { slug: candidate } })));

  const pages: { photoAId: string; photoBId: string | null; position: number }[] = [];
  for (let i = 0; i < source.length; i += 2) {
    pages.push({
      photoAId: source[i].id,
      photoBId: source[i + 1]?.id ?? null,
      position: pages.length,
    });
  }

  const album = await prisma.album.create({
    data: {
      userId: user.id,
      eventId: event.id,
      slug,
      title,
      subtitle,
      coverPhotoId: source[0].id,
      pages: { create: pages },
    },
  });

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard/albums");
  return { ok: true as const, slug: album.slug, pages: pages.length };
}

export async function deleteAlbum(albumId: string) {
  const user = await requireUser();
  const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id } });
  if (!album) return { ok: false as const, message: "Album not found" };
  await prisma.album.delete({ where: { id: albumId } });
  await deleteAlbumFiles(albumId);
  revalidatePath("/dashboard/albums");
  return { ok: true as const };
}

/** Saves album copy plus optional cover art and background music. */
export async function updateAlbumDetails(albumId: string, formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "album", "Albums");
  if (!gate.ok) return { ok: false as const, message: gate.message };

  const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id } });
  if (!album) return { ok: false as const, message: "Album not found" };

  const title = String(formData.get("title") || album.title).trim();
  if (title.length < 1) return { ok: false as const, message: "Add an album title" };

  const musicTitle = String(formData.get("musicTitle") || "").trim() || null;
  let coverPath = album.coverPath;
  let musicPath = album.musicPath;

  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const stored = await storeAlbumCover(albumId, cover);
    if ("error" in stored) return { ok: false as const, message: stored.error };
    coverPath = stored.relative;
  } else if (formData.get("removeCover") === "on") {
    coverPath = null;
  }

  const music = formData.get("music");
  if (music instanceof File && music.size > 0) {
    const stored = await storeAlbumMusic(albumId, music);
    if ("error" in stored) return { ok: false as const, message: stored.error };
    musicPath = stored.relative;
  } else if (formData.get("removeMusic") === "on") {
    await clearAlbumMusic(albumId);
    musicPath = null;
  }

  await prisma.album.update({
    where: { id: albumId },
    data: {
      title,
      subtitle: String(formData.get("subtitle") || "").trim() || null,
      coverPath,
      musicPath,
      musicTitle,
    },
  });

  revalidatePath(`/dashboard/albums/${albumId}`);
  revalidatePath("/dashboard/albums");
  revalidatePath(`/album/${album.slug}`);
  return { ok: true as const };
}

/** Swaps a spread with its neighbour; positions stay contiguous. */
export async function moveAlbumPage(albumId: string, pageId: string, direction: "up" | "down") {
  const user = await requireUser();
  const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id } });
  if (!album) return { ok: false as const, message: "Album not found" };

  const pages = await prisma.albumPage.findMany({
    where: { albumId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const index = pages.findIndex((page) => page.id === pageId);
  if (index === -1) return { ok: false as const, message: "Spread not found" };
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= pages.length) return { ok: true as const };

  const a = pages[index];
  const b = pages[swapWith];
  await prisma.$transaction([
    prisma.albumPage.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.albumPage.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  revalidatePath(`/dashboard/albums/${albumId}`);
  revalidatePath(`/album/${album.slug}`);
  return { ok: true as const };
}

export async function updateAlbumPageCaption(albumId: string, pageId: string, formData: FormData) {
  const user = await requireUser();
  const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id } });
  if (!album) return { ok: false as const, message: "Album not found" };

  await prisma.albumPage.updateMany({
    where: { id: pageId, albumId },
    data: { caption: String(formData.get("caption") || "").trim().slice(0, 160) || null },
  });
  revalidatePath(`/dashboard/albums/${albumId}`);
  revalidatePath(`/album/${album.slug}`);
  return { ok: true as const };
}

export async function setAlbumCoverPhoto(albumId: string, photoId: string) {
  const user = await requireUser();
  const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id } });
  if (!album) return { ok: false as const, message: "Album not found" };
  const photo = await prisma.photo.findFirst({ where: { id: photoId, eventId: album.eventId } });
  if (!photo) return { ok: false as const, message: "Photo not in this album" };
  await prisma.album.update({ where: { id: albumId }, data: { coverPhotoId: photoId } });
  revalidatePath(`/dashboard/albums/${albumId}`);
  revalidatePath(`/album/${album.slug}`);
  return { ok: true as const };
}

/** Renames a face cluster so clients can search by the person's name. */
export async function nameFaceGroup(eventId: string, faceIds: string[], name: string) {
  const user = await requireUser();
  const access = await accessFor(user.id);
  if (!access.can("faces")) return { ok: false as const, message: "Face search needs Silver or Gold." };
  const result = await renameFaceGroup(user.id, eventId, faceIds, name);
  if (result.ok) {
    revalidatePath(`/dashboard/events/${eventId}`);
    revalidatePath(`/g`);
  }
  return result;
}

export async function toggleAlbumPublished(albumId: string) {
  const user = await requireUser();
  const album = await prisma.album.findFirst({ where: { id: albumId, userId: user.id } });
  if (!album) return { ok: false as const, message: "Album not found" };
  await prisma.album.update({ where: { id: albumId }, data: { published: !album.published } });
  revalidatePath("/dashboard/albums");
  return { ok: true as const };
}

/** Face grouping for the dashboard: clusters the event's descriptors. */
export async function faceGroups(eventId: string, groups = 4) {
  const user = await requireUser();
  const access = await accessFor(user.id);
  if (!access.can("faces")) return { ok: false as const, message: "Face search needs Silver or Gold." };

  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
    include: { photos: { include: { face: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!event) return { ok: false as const, message: "Event not found" };

  const vectors = event.photos
    .filter((photo) => photo.face)
    .map((photo) => ({
      id: photo.id,
      name: photo.originalName,
      faceId: photo.face!.id,
      tag: photo.face!.tag,
      vector: JSON.parse(photo.face!.vector) as number[],
    }));

  if (vectors.length === 0) return { ok: true as const, groups: [], indexed: 0, total: event.photos.length };

  const { clusterVectors } = await import("@/lib/face");
  const clusters = clusterVectors(vectors, Math.max(1, Math.min(groups, 8)));
  return {
    ok: true as const,
    indexed: vectors.length,
    total: event.photos.length,
    groups: clusters.map((cluster) => ({
      label: cluster.label,
      name:
        vectors.find(
          (vector) => cluster.photoIds.includes(vector.id) && vector.tag && !/^Person \d+$/.test(vector.tag),
        )?.tag ?? null,
      count: cluster.photoIds.length,
      photoIds: cluster.photoIds,
      faceIds: vectors.filter((v) => cluster.photoIds.includes(v.id)).map((v) => v.faceId),
      names: vectors.filter((v) => cluster.photoIds.includes(v.id)).map((v) => v.name),
    })),
  };
}