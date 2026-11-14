import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessFor } from "@/lib/access";
import { ModuleHeader, PlanGate } from "@/components/PlanGate";
import { SiteEditor, type SiteService } from "@/components/SiteEditor";

export const metadata: Metadata = { title: "My website — PicDeck" };
export const instant = false;

export default async function WebsitePage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await accessFor(user.id);
  if (!access.can("website")) return <PlanGate module="website" tier={access.tier} />;

  const [site, eventCount] = await Promise.all([
    prisma.studioSite.findUnique({ where: { userId: user.id } }),
    prisma.event.count({ where: { userId: user.id } }),
  ]);

  let services: SiteService[] = [];
  if (site) {
    try {
      services = JSON.parse(site.services || "[]") as SiteService[];
    } catch {
      services = [];
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <ModuleHeader
        title="My website"
        subtitle="A one-page studio site on your own PicDeck address — no domain to buy."
      />
      <div className="mt-7">
        <SiteEditor
          user={{ name: user.name, city: user.city, email: user.email, phone: user.phone }}
          events={eventCount}
          site={
            site
              ? {
                  id: site.id,
                  slug: site.slug,
                  headline: site.headline,
                  about: site.about,
                  services,
                  whatsapp: site.whatsapp,
                  instagram: site.instagram,
                  city: site.city,
                  published: site.published,
                  coverUrl: site.coverPath ? `/api/site-cover/${site.id}` : null,
                  url: `${appUrl}/s/${site.slug}`,
                }
              : null
          }
        />
      </div>
    </div>
  );
}