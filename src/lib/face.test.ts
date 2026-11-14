import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  DESCRIPTOR_SIZE,
  clusterVectors,
  cosine,
  descriptorFor,
  randomSlug,
} from "./face";

async function solid(background: string) {
  return sharp({ create: { width: 120, height: 80, channels: 3, background } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe("descriptorFor", () => {
  it("returns a finite descriptor of the documented length", async () => {
    const vector = await descriptorFor(await solid("#c0392b"));
    expect(vector).not.toBeNull();
    expect(vector).toHaveLength(DESCRIPTOR_SIZE);
    expect(vector!.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("is deterministic for the same bytes", async () => {
    const buffer = await solid("#c0392b");
    const a = await descriptorFor(buffer);
    const b = await descriptorFor(buffer);
    expect(cosine(a!, b!)).toBeCloseTo(1, 10);
  });

  it("separates different colours", async () => {
    const red = await descriptorFor(await solid("#c0392b"));
    const blue = await descriptorFor(await solid("#1f3a93"));
    expect(cosine(red!, blue!)).toBeLessThan(0.8);
  });

  it("returns null when the bytes are not an image", async () => {
    expect(await descriptorFor(Buffer.from("definitely not an image"))).toBeNull();
  });
});

describe("cosine", () => {
  it("is 0 when either vector is empty", () => {
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosine([], [])).toBe(0);
  });

  it("is 1 for parallel vectors", () => {
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });
});

describe("clusterVectors", () => {
  it("groups identical vectors into separate sets", () => {
    const red = [1, 0, 0, 0];
    const blue = [0, 0, 0, 1];
    const vectors = [
      { id: "r1", vector: red },
      { id: "r2", vector: red },
      { id: "r3", vector: red },
      { id: "b1", vector: blue },
      { id: "b2", vector: blue },
      { id: "b3", vector: blue },
    ];

    const groups = clusterVectors(vectors, 2);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.photoIds.length).sort()).toEqual([3, 3]);
    // Deterministic: the same input yields the same grouping.
    expect(clusterVectors(vectors, 2)).toEqual(groups);
  });

  it("returns no groups for an empty event", () => {
    expect(clusterVectors([], 4)).toEqual([]);
  });
});

describe("randomSlug", () => {
  it("uses only the URL-safe alphabet", () => {
    const slug = randomSlug(12);
    expect(slug).toHaveLength(12);
    expect(slug).toMatch(/^[abcdefghijkmnpqrstuvwxyz23456789]+$/);
  });

  it("does not repeat itself", () => {
    expect(randomSlug(10)).not.toBe(randomSlug(10));
  });
});