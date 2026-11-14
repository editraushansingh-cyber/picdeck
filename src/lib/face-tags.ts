import { prisma } from "./db";
import { clusterVectors } from "./face";

const AUTO_NAME = /^Person \d+$/;

/**
 * Demo auto-tagging: clusters an event's descriptors and stores a stable person
 * label on each photo. Custom names (anything not matching "Person N") are kept
 * when regrouping, so the studio's renames survive.
 */
export async function autoTagEvent(eventId: string) {
  const photos = await prisma.photo.findMany({
    where: { eventId },
    select: { id: true, face: { select: { id: true, vector: true, tag: true } } },
  });
  const indexed = photos.filter((photo) => photo.face);
  if (indexed.length < 2) return { groups: 0, tagged: 0 };

  const vectors = indexed.map((photo) => ({
    id: photo.face!.id,
    vector: JSON.parse(photo.face!.vector) as number[],
  }));
  const k = Math.max(2, Math.min(6, Math.round(indexed.length / 3)));
  const clusters = clusterVectors(vectors, k);

  let tagged = 0;
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    if (cluster.photoIds.length === 0) continue;

    const members = indexed.filter((photo) => cluster.photoIds.includes(photo.face!.id));
    const custom = members
      .map((photo) => photo.face!.tag)
      .find((tag) => tag && !AUTO_NAME.test(tag));
    const label = custom ?? `Person ${index + 1}`;

    for (const photo of members) {
      const current = photo.face!.tag;
      if (!current || AUTO_NAME.test(current)) {
        if (current === label) continue;
        await prisma.faceDescriptor.update({
          where: { id: photo.face!.id },
          data: { tag: label },
        });
        tagged += 1;
      }
    }
  }

  return { groups: clusters.filter((cluster) => cluster.photoIds.length > 0).length, tagged };
}

/** Distinct person labels in one event, with photo counts. */
export async function faceTagsForEvent(eventId: string) {
  const rows = await prisma.faceDescriptor.findMany({
    where: { photo: { eventId }, tag: { not: null } },
    select: { tag: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.tag) continue;
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Renames one cluster's photos; ownership is checked through the event. */
export async function renameFaceGroup(userId: string, eventId: string, faceIds: string[], name: string) {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 1) return { ok: false as const, message: "Give the person a name" };
  if (faceIds.length === 0) return { ok: false as const, message: "Nothing to rename" };

  const owned = await prisma.faceDescriptor.count({
    where: {
      id: { in: [...new Set(faceIds)].slice(0, 200) },
      photo: { event: { id: eventId, userId } },
    },
  });
  if (owned === 0) return { ok: false as const, message: "Group not found" };

  await prisma.faceDescriptor.updateMany({
    where: {
      id: { in: [...new Set(faceIds)].slice(0, 200) },
      photo: { event: { id: eventId, userId } },
    },
    data: { tag: clean },
  });
  return { ok: true as const, name: clean };
}
