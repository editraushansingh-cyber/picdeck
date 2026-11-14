"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStudioSite, toggleSitePublished } from "@/app/actions/site";

export type SiteService = { title: string; price: string; description: string };

type SiteData = {
  id: string;
  slug: string;
  headline: string;
  about: string | null;
  services: SiteService[];
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  published: boolean;
  coverUrl: string | null;
  url: string;
};

const emptyService = (): SiteService => ({ title: "", price: "", description: "" });

export function SiteEditor({
  user,
  events,
  site,
}: {
  user: { name: string; city: string | null; email: string; phone: string };
  events: number;
  site: SiteData | null;
}) {
  const [services, setServices] = useState<SiteService[]>(
    site && site.services.length > 0 ? site.services : [emptyService()],
  );
  const [published, setPublished] = useState(site?.published ?? false);
  const [slug, setSlug] = useState(site?.slug ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveStudioSite(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSlug(result.slug);
      setMessage("Saved");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <form action={submit} className="space-y-4 rounded-xl border border-line bg-white p-5">
        {message && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <label className="text-sm font-medium" htmlFor="slug">
            Site address
          </label>
          <div className="mt-1.5 flex items-center gap-1 rounded-lg border border-line px-3 py-2">
            <span className="shrink-0 text-sm text-muted">picdeck.app/s/</span>
            <input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="frames-by-you"
              className="min-w-0 flex-1 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <span className="text-sm font-medium">Cover photo</span>
          <p className="mt-0.5 text-xs text-muted">Wide image, cropped to 1600×900 for the site hero.</p>
          {site?.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.coverUrl}
              alt="Current cover"
              className="mt-2 h-32 w-full max-w-md rounded-lg border border-line object-cover"
            />
          )}
          <input
            type="file"
            name="cover"
            accept="image/*"
            className="mt-2 block w-full max-w-md text-xs text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-surface"
          />
          {site?.coverUrl && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="removeCover" className="size-3.5 accent-[var(--pd-brand)]" />
              Remove the current cover
            </label>
          )}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="headline">
            Headline
          </label>
          <input
            id="headline"
            name="headline"
            required
            defaultValue={site?.headline ?? ""}
            placeholder="Weddings, shot like film — Chennai & Coimbatore"
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="about">
            About
          </label>
          <textarea
            id="about"
            name="about"
            rows={4}
            defaultValue={site?.about ?? ""}
            placeholder="Ten years of covering south Indian weddings. Two shooters, one second photographer, no staged smiles."
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">WhatsApp</span>
            <input
              name="whatsapp"
              defaultValue={site?.whatsapp ?? user.phone}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium">Instagram</span>
            <input
              name="instagram"
              defaultValue={site?.instagram ?? ""}
              placeholder="@yourstudio"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">City</span>
          <input
            name="city"
            defaultValue={site?.city ?? user.city ?? ""}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Services &amp; packages</span>
            <button
              type="button"
              onClick={() => setServices((current) => [...current, emptyService()])}
              className="text-xs font-medium text-brand hover:underline"
            >
              + Add package
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {services.map((service, index) => (
              <div key={index} className="rounded-lg border border-line p-3">
                <div className="flex gap-2">
                  <input
                    name="service_title"
                    placeholder="Full wedding coverage"
                    aria-label={`Package ${index + 1} title`}
                    value={service.title}
                    onChange={(event) =>
                      setServices((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, title: event.target.value } : item,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                  />
                  <input
                    name="service_price"
                    placeholder="₹1,20,000"
                    aria-label={`Package ${index + 1} price`}
                    value={service.price}
                    onChange={(event) =>
                      setServices((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, price: event.target.value } : item,
                        ),
                      )
                    }
                    className="w-32 rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                  />
                  {services.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setServices((current) => current.filter((_, i) => i !== index))
                      }
                      className="px-1 text-xs text-muted hover:text-red-600"
                      aria-label="Remove package"
                    >
                      ×
                    </button>
                  )}
                </div>
                <input
                  name="service_description"
                  placeholder="Two days, 500 edited photos, one album"
                  aria-label={`Package ${index + 1} description`}
                  value={service.description}
                  onChange={(event) =>
                    setServices((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="published"
            checked={published}
            onChange={(event) => setPublished(event.target.checked)}
            className="size-4 accent-[var(--pd-brand)]"
          />
          Publish the site publicly
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save website"}
        </button>
      </form>

      <aside className="space-y-4">
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Status</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                published ? "bg-brand-soft text-brand" : "bg-surface text-muted"
              }`}
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            {published
              ? "Anyone with the link can see your studio page."
              : "Only you can see it. Publish when ready."}
          </p>
          {slug && (
            <a
              href={`/s/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              Preview page
            </a>
          )}
          {site && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await toggleSitePublished();
                  if (!result.ok) setError(result.message);
                  else {
                    setPublished((current) => !current);
                    router.refresh();
                  }
                })
              }
              className="ml-2 mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
            >
              {published ? "Unpublish" : "Publish now"}
            </button>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-medium">What visitors see</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Headline and about copy</li>
            <li>Package cards with prices</li>
            <li>WhatsApp button straight to you</li>
            <li>Instagram link</li>
            <li>{events} events delivered on PicDeck</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}