import crypto from "crypto";
import sharp from "sharp";

/**
 * Demo face/photo matching.
 *
 * This is deliberately *not* a neural embedding. It builds a fixed-length
 * descriptor from the image's colour statistics and aspect ratio, which makes
 * "find similar photos" deterministic and instant with zero dependencies.
 * The pipeline (descriptor → index → cosine search) is the same shape as a real
 * face-recognition service; swap `descriptorFor()` for a model call to go live.
 */

export const DESCRIPTOR_SIZE = 71;

/** Throws on files sharp cannot read (RAW without a preview, corrupt uploads). */
export async function descriptorFor(buffer: Buffer): Promise<number[] | null> {
  try {
    const image = sharp(buffer).rotate();
    const meta = await image.metadata();
    const { data, info } = await image
      .resize(24, 24, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    // 4×4×4 colour bins (2 bits per channel) = 64 buckets, in 0..63.
    const buckets = new Array(64).fill(0);
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let lumSum = 0;
    let lumSqSum = 0;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1] ?? r;
      const b = data[i + 2] ?? r;
      rSum += r;
      gSum += g;
      bSum += b;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumSum += lum;
      lumSqSum += lum * lum;
      buckets[((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6)] += 1;
    }

    const px = (data.length / channels) || 1;
    const mean = lumSum / px;
    const variance = Math.max(0, lumSqSum / px - mean * mean);
    const ratio = meta.width && meta.height ? meta.width / meta.height : 1;

    const vector: number[] = [];
    for (const bucket of buckets) vector.push(bucket / px);
    vector.push(rSum / px / 255, gSum / px / 255, bSum / px / 255);
    vector.push(mean / 255, Math.min(1, Math.sqrt(variance) / 128), Math.min(2, ratio) / 2);

    // Pad to a stable length so stored vectors stay comparable across uploads.
    while (vector.length < DESCRIPTOR_SIZE) vector.push(0);
    return vector.slice(0, DESCRIPTOR_SIZE);
  } catch {
    return null;
  }
}

export function cosine(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Groups descriptors into `k` clusters (k-means, fixed seed, bounded iterations). */
export function clusterVectors(vectors: { id: string; vector: number[] }[], k: number) {
  if (vectors.length === 0) return [];
  const groups = Math.max(1, Math.min(k, vectors.length));
  // Deterministic seeding: spread initial centroids across the sorted list.
  const centroids: number[][] = [];
  for (let i = 0; i < groups; i += 1) {
    const index = Math.floor((i * vectors.length) / groups);
    centroids.push([...vectors[index].vector]);
  }

  const assignment = new Array(vectors.length).fill(0);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    let moved = false;
    for (let v = 0; v < vectors.length; v += 1) {
      let best = 0;
      let bestScore = -Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const score = cosine(vectors[v].vector, centroids[c]);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (assignment[v] !== best) {
        assignment[v] = best;
        moved = true;
      }
    }
    const sums = centroids.map(() => new Array(vectors[0].vector.length).fill(0));
    const counts = centroids.map(() => 0);
    vectors.forEach((item, index) => {
      const c = assignment[index];
      counts[c] += 1;
      item.vector.forEach((value, d) => {
        sums[c][d] += value;
      });
    });
    sums.forEach((sum, c) => {
      if (counts[c] > 0) centroids[c] = sum.map((value) => value / counts[c]);
    });
    if (!moved) break;
  }

  return centroids.map((_, c) => ({
    label: String.fromCharCode(65 + (c % 26)),
    photoIds: vectors.filter((_, index) => assignment[index] === c).map((item) => item.id),
  }));
}

export function randomSlug(length = 10) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}