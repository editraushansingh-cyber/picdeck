import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { readStored } from "@/lib/storage";

/**
 * Studio site cover. Published sites are public; drafts are visible only to the
 * owning studio. Only the generated 1600×900 webp is ever served.
 */
export async function GET(_request: Request, context: RouteContext<"/api/site-cover/[id]">) {
  const { id } = await context.params;
  const site = await prisma.studioSite.findUnique({
    where: { id },
    select: { userId: true, published: true, coverPath: true },
  });
  if (!site?.coverPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!site.published) {
    const userId = await getUserId();
    if (userId !== site.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readStored(site.coverPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": site.published ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}