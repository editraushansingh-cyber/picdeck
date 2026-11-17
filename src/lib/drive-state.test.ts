import { describe, expect, it } from "vitest";
import { createDriveState, driveStateHash } from "./drive-state";

describe("database-backed Drive state", () => {
  it("creates an opaque state value with a stable server-side hash", () => {
    const state = createDriveState();

    expect(state).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(driveStateHash(state)).toMatch(/^[a-f0-9]{64}$/);
    expect(driveStateHash(state)).toBe(driveStateHash(state));
  });
});
