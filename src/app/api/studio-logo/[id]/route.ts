import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStored } from "@/lib/storage";

/** Studio logo for public album/branding surfaces. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { logoPath: true },
  });
  if (!user?.logoPath) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const file = await readStored(user.logoPath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
