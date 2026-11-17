import { describe, expect, it } from "vitest";
import { createDriveState, callbackStateUser } from "./drive-state";

describe("callbackStateUser", () => {
  it("accepts the signed callback state for the active studio without relying on a browser state cookie", () => {
    const state = createDriveState("studio-a");

    expect(callbackStateUser(state, "studio-a")).toBe("studio-a");
  });

  it("rejects a valid state when it belongs to another signed-in studio", () => {
    const state = createDriveState("studio-a");

    expect(callbackStateUser(state, "studio-b")).toBeNull();
  });
});
