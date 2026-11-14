import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { studioByCode } from "@/lib/studio";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const studio = await studioByCode(code);
  return {
    title: studio ? `${studio.name} — all events` : "Studio not found — PicDeck",
    robots: { index: false, follow: false },
  };
}

export default async function StudioHubPage({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const studio = await studioByCode(code);
  if (!studio) notFound();

  const albums = studio.events.flatMap((event) =>
    event.albums.map((album) => ({ ...album, eventTitle: event.title })),
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Studio hub</p>
          <h1 className="mt-3 font-serif text-3xl">{studio.name}</h1>
          {studio.city && <p className="mt-1 text-sm text-muted">{studio.city}</p>}
          {studio.studioSite?.published && (
            <Link
              href={`/s/${studio.studioSite.slug}`}
              className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
            >
              Visit the studio website →
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">Events</h2>
        {studio.events.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
            No events yet.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {studio.events.map((event) => (
              <li key={event.id} className="rounded-xl border border-line bg-white p-4">
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {event.eventDate
                    ? event.eventDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Date to be announced"}
                  {event.clientName ? ` · ${event.clientName}` : ""}
                </p>
                <a
                  href={`/g?code=${event.galleryCode}`}
                  className="mt-3 inline-block rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
                >
                  Open gallery
                </a>
                {event.albums.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-2">
                    {event.albums.map((album) => (
                      <li key={album.slug}>
                        <Link
                          href={`/album/${album.slug}`}
                          className="text-xs text-brand hover:underline"
                        >
                          {album.title} · flipbook
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        {albums.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Digital albums
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {albums.map((album) => (
                <li key={album.slug}>
                  <Link href={`/album/${album.slug}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface">
                      {album.coverPath || album.coverPhotoId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            album.coverPath
                              ? `/api/album-cover/${album.id}`
                              : `/api/album-photos/${album.coverPhotoId}`
                          }
                          alt={album.title}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-muted">
                          {album.title}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium">{album.title}</p>
                    <p className="text-xs text-muted">{album.eventTitle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-xs text-muted">
          Shared with one QR code · Private link, please do not forward publicly.
        </p>
      </main>
    </div>
  );
}
