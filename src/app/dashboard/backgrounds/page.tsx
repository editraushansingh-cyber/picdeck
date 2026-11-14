import type { Metadata } from "next";
import { BACKDROPS } from "@/lib/backgrounds";

export const metadata: Metadata = { title: "Backgrounds — PicDeck" };

export default function BackgroundsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Background library</h1>
        <p className="mt-1 text-sm text-muted">
          Eight print-ready 2000 px backdrops for album spreads, cards and social posts. Preview here,
          download the full-size JPEG and drop it into your layout.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BACKDROPS.map((backdrop) => (
          <li key={backdrop.id} className="overflow-hidden rounded-xl border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/backgrounds/${backdrop.id}?w=480`}
              alt={backdrop.name}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-medium">{backdrop.name}</p>
                <p className="text-xs text-muted">
                  {backdrop.motif} · {backdrop.tone}
                </p>
              </div>
              <a
                href={`/api/backgrounds/${backdrop.id}?download=1`}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface"
              >
                Download
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">
        These are generated, flattened backdrops. When a layered PSD pack is supplied, replace{" "}
        <code className="rounded bg-surface px-1">lib/backgrounds.ts</code> with a file lookup.
      </p>
    </div>
  );
}
