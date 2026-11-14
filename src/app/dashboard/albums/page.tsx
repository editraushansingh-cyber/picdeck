import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { ModuleHeader, PlanGate } from "@/components/PlanGate";
import { AlbumRow } from "@/components/AlbumRow";

export const metadata: Metadata = { title: "Albums — PicDeck" };
export const instant = false;

export default async function AlbumsPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("album")) return <PlanGate module="album" tier={access.tier} />;

  const albums = await prisma.album.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true } },
      _count: { select: { pages: true } },
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <ModuleHeader
        title="Digital albums"
        subtitle={`${albums.length} ${albums.length === 1 ? "album" : "albums"} · built from each event's selection`}
      />

      {albums.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <h2 className="font-medium">No albums yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Open an event, scroll to the album panel and press “Create album”. PicDeck lays the
            selected photos out as page spreads and gives you a private link to share.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Go to events
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {albums.map((album) => (
            <AlbumRow
              key={album.id}
              album={{
                id: album.id,
                title: album.title,
                subtitle: album.subtitle,
                slug: album.slug,
                published: album.published,
                views: album.views,
                pages: album._count.pages,
                eventTitle: album.event.title,
                eventId: album.event.id,
                url: `${appUrl}/album/${album.slug}`,
                createdAt: album.createdAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}