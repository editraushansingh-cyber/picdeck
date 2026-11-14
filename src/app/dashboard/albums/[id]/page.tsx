import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { PlanGate } from "@/components/PlanGate";
import { AlbumEditor } from "@/components/AlbumEditor";

export const metadata: Metadata = { title: "Album editor — PicDeck" };
export const instant = false;

export default async function AlbumEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("album")) return <PlanGate module="album" tier={access.tier} />;

  const { id } = await params;
  const album = await prisma.album.findFirst({
    where: { id, userId: user.id },
    include: {
      pages: {
        orderBy: { position: "asc" },
        include: {
          photoA: { select: { id: true, originalName: true, thumbPath: true } },
          photoB: { select: { id: true, originalName: true, thumbPath: true } },
        },
      },
    },
  });
  if (!album) notFound();

  return (
    <AlbumEditor
      album={{
        id: album.id,
        slug: album.slug,
        title: album.title,
        subtitle: album.subtitle,
        published: album.published,
        musicTitle: album.musicTitle,
        coverPhotoId: album.coverPhotoId,
        coverUrl: album.coverPath
          ? `/api/album-cover/${album.id}`
          : album.coverPhotoId
            ? `/api/album-photos/${album.coverPhotoId}`
            : null,
        musicUrl: album.musicPath ? `/api/album-music/${album.id}` : null,
        pages: album.pages.map((page) => ({
          id: page.id,
          caption: page.caption,
          a: { id: page.photoA.id, alt: page.photoA.originalName, hasThumb: !!page.photoA.thumbPath },
          b: page.photoB
            ? { id: page.photoB.id, alt: page.photoB.originalName, hasThumb: !!page.photoB.thumbPath }
            : null,
        })),
      }}
    />
  );
}
