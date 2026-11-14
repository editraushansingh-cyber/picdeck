import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUnlockedEvent } from "@/lib/gallery-session";
import { accessFor } from "@/lib/access";
import { cosine, descriptorFor } from "@/lib/face";

/**
 * Face/similarity search inside one unlocked client gallery.
 *
 * The probe (a selfie) is reduced to the same deterministic descriptor used at
 * upload time, then compared against the event's indexed photos with cosine
 * similarity. No photo ever leaves the studio's storage: only ids and scores are
 * returned. Swap `descriptorFor` in lib/face.ts for a real embedding model.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") || "").replace(/\D/g, "").slice(0, 6);
  const probe = form.get("probe");

  if (code.length !== 6) return NextResponse.json({ error: "Invalid gallery" }, { status: 400 });
  if (!(probe instanceof File)) return NextResponse.json({ error: "Add a selfie" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { galleryCode: code } });
  if (!event || event.status !== "ACTIVE") {
    return NextResponse.json({ error: "Gallery not found" }, { status: 404 });
  }

  const gallery = await getUnlockedEvent(event.id);
  if (!gallery) return NextResponse.json({ error: "Unlock the gallery first" }, { status: 403 });

  // Face search is a plan feature of the studio; the client just sees the result.
  const access = await accessFor(event.userId);
  if (!access.can("faces")) {
    return NextResponse.json(
      { error: "Face search is not enabled for this gallery" },
      { status: 403 },
    );
  }

  const vector = await descriptorFor(Buffer.from(await probe.arrayBuffer()));
  if (!vector) return NextResponse.json({ error: "Could not read that image" }, { status: 400 });

  const indexed = await prisma.faceDescriptor.findMany({
    where: { photo: { eventId: event.id } },
    select: { photoId: true, vector: true },
  });

  const scored = indexed
    .map((row) => ({
      photoId: row.photoId,
      score: cosine(vector, JSON.parse(row.vector) as number[]),
    }))
    .sort((a, b) => b.score - a.score);

  // Cosine on this descriptor sits roughly in 0.5–1.0; keep the top matches but
  // never invent confidence. Below the floor we say "no clear match".
  const THRESHOLD = 0.62;
  const matches = scored.filter((row) => row.score >= THRESHOLD).slice(0, 40);

  return NextResponse.json({
    indexed: indexed.length,
    threshold: THRESHOLD,
    matches,
    note:
      indexed.length === 0
        ? "This gallery has no indexed photos yet."
        : matches.length === 0
          ? "No clear match in this gallery."
          : null,
  });
}