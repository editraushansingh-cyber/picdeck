import { describe, expect, it } from "vitest";
import { CHANNEL_LABELS, NOTIFICATION_TEMPLATES, renderTemplate } from "./notifications";

describe("renderTemplate", () => {
  it("fills every placeholder", () => {
    const text = renderTemplate(NOTIFICATION_TEMPLATES.gallery_ready.body, {
      name: "Ananya",
      event: "Reception",
      link: "http://localhost:3000/g/123456",
      note: "Pick by Sunday",
    });
    expect(text).toContain("Ananya");
    expect(text).toContain("Reception");
    expect(text).toContain("/g/123456");
    expect(text).not.toContain("{{");
  });

  it("marks missing values instead of printing a blank", () => {
    const text = renderTemplate("Hi {{name}}, {{missing}}", { name: "Meera" });
    expect(text).toBe("Hi Meera, —");
  });
});

describe("channels", () => {
  it("only offers email, never SMS or WhatsApp", () => {
    expect(Object.keys(CHANNEL_LABELS)).toEqual(["email"]);
  });
});