import path from "path";
import { describe, expect, it } from "vitest";
import {
  absolutePath,
  deleteSiteCover,
  extractEmbeddedJpeg,
  storeSiteCover,
} from "./storage";

const ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");

describe("absolutePath", () => {
  it("resolves paths inside storage", () => {
    const resolved = absolutePath("events/abc/thumb/one.webp");
    expect(resolved.startsWith(path.resolve(ROOT))).toBe(true);
    expect(resolved.endsWith(path.join("events", "abc", "thumb", "one.webp"))).toBe(true);
  });

  it("refuses traversal outside storage", () => {
    expect(() => absolutePath("../package.json")).toThrow("INVALID_PATH");
    expect(() => absolutePath("events/../../etc/passwd")).toThrow("INVALID_PATH");
  });
});

describe("storeSiteCover", () => {
  it("rejects a non-image upload", async () => {
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    await expect(storeSiteCover("test-user", file)).resolves.toEqual({
      error: "Cover must be an image",
    });
  });

  it("rejects an oversized upload", async () => {
    const big = new Uint8Array(26 * 1024 * 1024);
    const file = new File([big], "big.jpg", { type: "image/jpeg" });
    await expect(storeSiteCover("test-user", file)).resolves.toEqual({
      error: "Cover is larger than 25 MB",
    });
  });
});

describe("deleteSiteCover", () => {
  it("does not throw when there is no cover", async () => {
    await expect(deleteSiteCover("nobody-has-this-cover")).resolves.toBeUndefined();
  });
});

describe("extractEmbeddedJpeg", () => {
  it("picks the largest embedded JPEG preview from a RAW-like buffer", () => {
    const small = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(64, 1), Buffer.from([0xff, 0xd9])]);
    const large = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.alloc(20_000, 2),
      Buffer.from([0xff, 0xd9]),
    ]);
    const raw = Buffer.concat([Buffer.alloc(128, 0), small, Buffer.alloc(64, 0), large]);

    const preview = extractEmbeddedJpeg(raw);
    expect(preview).not.toBeNull();
    expect(preview!.length).toBe(large.length);
    expect(preview![0]).toBe(0xff);
    expect(preview![1]).toBe(0xd8);
  });

  it("returns null when only a tiny thumbnail is present", () => {
    const tiny = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(64, 1), Buffer.from([0xff, 0xd9])]);
    expect(extractEmbeddedJpeg(tiny)).toBeNull();
  });
});