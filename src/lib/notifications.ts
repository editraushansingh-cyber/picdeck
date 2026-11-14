/** Notification templates. `{{placeholder}}` values are filled at compose time. */

export type TemplateKey =
  | "gallery_ready"
  | "selection_reminder"
  | "album_ready"
  | "invoice_sent"
  | "invite_ready";

export const NOTIFICATION_TEMPLATES: Record<
  TemplateKey,
  { label: string; body: string; fields: string[] }
> = {
  gallery_ready: {
    label: "Gallery is ready",
    body:
      "Hi {{name}}, your photos from {{event}} are ready to review. Open {{link}} and pick your favourites — {{note}}",
    fields: ["name", "event", "link", "note"],
  },
  selection_reminder: {
    label: "Selection reminder",
    body:
      "Hi {{name}}, a gentle reminder to finish picking your photos for {{event}}. Your gallery: {{link}}",
    fields: ["name", "event", "link"],
  },
  album_ready: {
    label: "Album is live",
    body: "Hi {{name}}, your album for {{event}} is online: {{link}}",
    fields: ["name", "event", "link"],
  },
  invoice_sent: {
    label: "Invoice shared",
    body:
      "Hi {{name}}, your {{type}} {{number}} for {{event}} is ready. Amount due ₹{{total}}. Details: {{link}}",
    fields: ["name", "type", "number", "event", "total", "link"],
  },
  invite_ready: {
    label: "Invitation ready",
    body: "Hi {{name}}, here is the invitation for {{event}}: {{link}}",
    fields: ["name", "event", "link"],
  },
};

export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key]?.trim() || `—`);
}

export function mailtoLink(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Notification channels in this build. SMS and WhatsApp are deliberately not
 * implemented: nothing is sent to a phone number, so the UI never pretends to.
 */
export const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
};