import { describe, expect, it } from "vitest";
import { qualityForUpload, shouldCompressUpload } from "./upload-quality";

describe("upload quality choices", () => {
  it("keeps 100% uploads untouched", () => {
    expect(qualityForUpload("original")).toBeNull();
    expect(shouldCompressUpload("original", "wedding.jpg")).toBe(false);
  });

  it("maps the requested JPEG presets to encoder qualities", () => {
    expect(qualityForUpload("high")).toBe(0.5);
    expect(qualityForUpload("medium")).toBe(0.3);
    expect(qualityForUpload("small")).toBe(0.2);
  });

  it("never transcodes camera RAW files", () => {
    expect(shouldCompressUpload("small", "IMG_001.CR3")).toBe(false);
    expect(shouldCompressUpload("high", "portrait.jpeg")).toBe(true);
  });
});
