/** Invitation designs offered in the studio dashboard. */
export const INVITE_TEMPLATES = ["ivory", "marigold", "midnight", "rose"] as const;

export type InviteTemplate = (typeof INVITE_TEMPLATES)[number];

export function isInviteTemplate(value: string): value is InviteTemplate {
  return (INVITE_TEMPLATES as readonly string[]).includes(value);
}
