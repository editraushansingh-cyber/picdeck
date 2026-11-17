import crypto from "crypto";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function passwordResetTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isUsablePasswordReset(
  token: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
) {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}
