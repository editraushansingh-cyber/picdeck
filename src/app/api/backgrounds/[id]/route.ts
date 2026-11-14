import { NextResponse } from "next/server";
import { backdropById, renderBackdrop } from "@/lib/backgrounds";

/** Rendered backdrop: ?w=400 for previews, ?download=1 for the 2000px file. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!backdropById(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const width = download ? 2000 : Math.min(1200, Math.max(200, Number(url.searchParams.get("w")) || 480));

  const buffer = await renderBackdrop(id, width);
  if (!buffer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": download ? `attachment; filename="picdeck-${id}.jpg"` : "inline",
    },
  });
}
