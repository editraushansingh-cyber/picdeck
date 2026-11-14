import { describe, expect, it } from "vitest";
import { INVITE_TEMPLATES, isInviteTemplate } from "./invitations";

describe("isInviteTemplate", () => {
  it("accepts the four shipped designs", () => {
    for (const template of INVITE_TEMPLATES) {
      expect(isInviteTemplate(template)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isInviteTemplate("neon")).toBe(false);
    expect(isInviteTemplate("")).toBe(false);
  });
});