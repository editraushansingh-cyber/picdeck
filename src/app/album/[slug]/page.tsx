import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { AlbumViewer } from "@/components/AlbumViewer";

export const instant = false;

async function loadAlbum(slug: string) {
  return prisma.album.findUnique({
    where: { slug },
    include: {
      event: { select: { title: true, clientName: true } },
      user: { select: { id: true, logoPath: true } },
      pages: {
        orderBy: { position: "asc" },
        include: {
          photoA: { select: { id: true, originalName: true, thumbPath: true, previewPath: true } },
          photoB: { select: { id: true, originalName: true, thumbPath: true, previewPath: true } },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const album = await loadAlbum(slug);
  if (!album) return { title: "Album not found — PicDeck" };
  return {
    title: `${album.title} — PicDeck album`,
    description: album.subtitle ?? `A digital album from ${album.event.title}`,
  };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const album = await loadAlbum(slug);
  if (!album || !album.published) notFound();

  await prisma.album.update({ where: { id: album.id }, data: { views: { increment: 1 } } });

  return (
    <AlbumViewer
      title={album.title}
      subtitle={album.subtitle}
      eventTitle={album.event.title}
      coverUrl={
        album.coverPath
          ? `/api/album-cover/${album.id}`
          : album.coverPhotoId
            ? `/api/album-photos/${album.coverPhotoId}`
            : null
      }
      logoUrl={album.user.logoPath ? `/api/studio-logo/${album.user.id}` : null}
      musicUrl={album.musicPath ? `/api/album-music/${album.id}` : null}
      musicTitle={album.musicTitle}
      pages={album.pages.map((page) => ({
        id: page.id,
        caption: page.caption,
        a: {
          id: page.photoA.id,
          alt: page.photoA.originalName,
          hasThumb: !!page.photoA.thumbPath,
        },
        b: page.photoB
          ? { id: page.photoB.id, alt: page.photoB.originalName, hasThumb: !!page.photoB.thumbPath }
          : null,
      }))}
    />
  );
}