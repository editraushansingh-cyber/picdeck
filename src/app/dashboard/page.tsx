import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NewEventDialog } from "@/components/NewEventDialog";

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function DashboardPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const events = await prisma.event.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: true, selections: true } } },
  });

  const totalPhotos = events.reduce((sum, event) => sum + event._count.photos, 0);
  const totalSelections = events.reduce((sum, event) => sum + event._count.selections, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted">
            {events.length} {events.length === 1 ? "event" : "events"} · {totalPhotos} photos ·{" "}
            {totalSelections} selected
          </p>
        </div>
        <NewEventDialog />
      </div>

      {events.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <h2 className="font-medium">No events yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Create your first event: PicDeck will generate a private gallery and a 6-digit code you
            can send to your client right away.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/dashboard/events/${event.id}`}
                className="block rounded-xl border border-line bg-white p-5 transition hover:border-brand/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium">{event.title}</h2>
                    <p className="mt-0.5 text-sm text-muted">
                      {event.eventDate
                        ? event.eventDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                        : "Date not set"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      event.status === "ACTIVE"
                        ? "bg-brand-soft text-brand"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {event.status === "ACTIVE" ? "Active" : "Archived"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-mono tracking-widest text-muted">{event.galleryCode}</span>
                  <span className="text-muted">
                    {event._count.photos} photos · {event._count.selections} selected
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}