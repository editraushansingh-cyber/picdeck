import { describe, expect, it } from "vitest";
import { BACKDROPS, backdropById, backdropSvg } from "./backgrounds";

describe("backdrop library", () => {
  it("ships eight labelled backdrops with unique ids", () => {
    expect(BACKDROPS).toHaveLength(8);
    expect(new Set(BACKDROPS.map((backdrop) => backdrop.id)).size).toBe(8);
    for (const backdrop of BACKDROPS) {
      expect(backdrop.name.length).toBeGreaterThan(0);
      expect(backdrop.palette).toHaveLength(3);
    }
  });

  it("looks backdrops up by id", () => {
    expect(backdropById(BACKDROPS[0].id)?.name).toBe(BACKDROPS[0].name);
    expect(backdropById("nope")).toBeNull();
  });

  it("renders a 2000px SVG for every backdrop", () => {
    for (const backdrop of BACKDROPS) {
      const svg = backdropSvg(backdrop.id);
      expect(svg).toContain('width="2000"');
      expect(svg).toContain('height="2000"');
      expect(svg!.startsWith("<svg")).toBe(true);
    }
    expect(backdropSvg("missing")).toBeNull();
  });
});