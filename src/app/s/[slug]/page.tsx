import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await prisma.studioSite.findUnique({ where: { slug } });
  if (!site) return { title: "Studio not found — PicDeck" };
  return { title: `${site.headline} — PicDeck`, description: site.about ?? undefined };
}

type Service = { title: string; price: string; description: string };

export default async function StudioSitePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const site = await prisma.studioSite.findUnique({
    where: { slug },
    include: { user: { select: { name: true, city: true } } },
  });
  if (!site || !site.published) notFound();

  const services = (JSON.parse(site.services || "[]") as Service[]).filter((s) => s.title);
  const packages = await prisma.subscription.findMany({
    where: { userId: site.userId },
    take: 1,
    include: { plan: true },
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <p className="font-semibold tracking-tight">{site.user.name}</p>
          <nav className="flex items-center gap-5 text-sm text-muted">
            {services.length > 0 && <a href="#services" className="hover:text-ink">Services</a>}
            <a href="#contact" className="hover:text-ink">Contact</a>
          </nav>
        </div>
      </header>

      {site.coverPath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/site-cover/${site.id}`}
          alt={`${site.user.name} cover photo`}
          className="h-56 w-full object-cover sm:h-80"
        />
      )}

      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">
            {site.city || site.user.city || "Wedding photography"}
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {site.headline}
          </h1>
          {site.about && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{site.about}</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {site.whatsapp && (
              <a
                href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand/90"
              >
                Message on WhatsApp
              </a>
            )}
            {site.instagram && (
              <a
                href={`https://instagram.com/${site.instagram.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line px-5 py-3 text-sm font-medium hover:bg-white"
              >
                Instagram
              </a>
            )}
          </div>
        </div>
      </section>

      {services.length > 0 && (
        <section id="services" className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-xl font-semibold tracking-tight">Services &amp; packages</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.title} className="rounded-xl border border-line p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">{service.title}</h3>
                  {service.price && (
                    <span className="text-sm font-semibold text-brand">{service.price}</span>
                  )}
                </div>
                {service.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{service.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="contact" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-xl font-semibold tracking-tight">Book a date</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Tell us the date and venue. We reply the same day.
          </p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            {site.whatsapp && (
              <div>
                <dt className="text-muted">WhatsApp</dt>
                <dd className="mt-0.5 font-medium">{site.whatsapp}</dd>
              </div>
            )}
            {site.instagram && (
              <div>
                <dt className="text-muted">Instagram</dt>
                <dd className="mt-0.5 font-medium">@{site.instagram.replace("@", "")}</dd>
              </div>
            )}
            {packages[0] && (
              <div>
                <dt className="text-muted">Platform</dt>
                <dd className="mt-0.5 font-medium">On {packages[0].plan.name}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-muted">
          <p>© {site.user.name}</p>
          <Link href="/" className="hover:text-ink">Made with PicDeck</Link>
        </div>
      </footer>
    </div>
  );
}