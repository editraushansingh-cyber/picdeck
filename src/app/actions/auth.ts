"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, randomReferralCode } from "@/lib/auth";
import { grantReferralCredit } from "@/lib/referrals";
import { sendEmail } from "@/lib/mail";
import {
  createPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
  passwordResetTokenHash,
} from "@/lib/password-reset";

function normalizePhone(countryCode: string, raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  const cc = countryCode.trim().startsWith("+") ? countryCode.trim() : `+${countryCode.trim()}`;
  return `${cc}${digits}`;
}

export async function checkPhoneAvailable(phone: string) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  return !existing;
}

export async function registerUser(formData: FormData) {
  const countryCode = String(formData.get("country_code") || "+91");
  const rawPhone = String(formData.get("phone") || "");
  const phone = normalizePhone(countryCode, rawPhone);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("password_confirmation") || "");
  const city = String(formData.get("city") || "").trim() || null;
  const pinCode = String(formData.get("pin_code") || "").trim() || null;
  const address = String(formData.get("billing_address") || "").trim() || null;
  const profession = String(formData.get("profession") || "photographer");
  const referralCodeInput = String(formData.get("referral_code") || "").trim().toUpperCase();
  const consent = String(formData.get("consent") || "") === "on";

  const fail = (message: string) => ({ ok: false as const, message });

  if (!consent) return fail("Please accept the terms to continue");
  if (!name || name.length < 2) return fail("Enter your full name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address");
  if (password.length < 8) return fail("Password must be at least 8 characters");
  if (password !== confirm) return fail("Passwords do not match");

  if (!(await checkPhoneAvailable(phone))) return fail("This phone number is already registered");
  if (await prisma.user.findUnique({ where: { email } })) return fail("This email is already registered");

  let referredById: string | null = null;
  if (referralCodeInput) {
    const referrer = await prisma.user.findUnique({ where: { referralCode: referralCodeInput } });
    if (referrer) referredById = referrer.id;
  }

  let referralCode = randomReferralCode();
  while (await prisma.user.findUnique({ where: { referralCode } })) {
    referralCode = randomReferralCode();
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      profession,
      countryCode,
      city,
      pinCode,
      address,
      referralCode,
      referredById,
      // OTP and SMS are removed from this build: there is no phone verification.
      phoneVerifiedAt: new Date(),
    },
  });

  // Start on the ongoing Free plan; paid plans are assigned by the admin or checkout.
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
  if (freePlan) {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: freePlan.id,
        status: "ACTIVE",
      },
    });
  }

  await createSession(user.id);
  if (referredById) {
    // Best-effort: a credit ledger failure must not block the signup.
    try {
      await grantReferralCredit(referredById, user.id);
    } catch {
      // ignore
    }
  }
  return { ok: true as const, redirectTo: "/dashboard" };
}

export async function loginUser(formData: FormData) {
  const identifier = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
  });
  const invalid = { ok: false as const, message: "Invalid email or password" };
  if (!user) return invalid;
  const { verifyPassword } = await import("@/lib/auth");
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;
  await createSession(user.id);
  return { ok: true as const, redirectTo: "/dashboard" };
}

const RESET_REQUEST_MESSAGE = "If that email belongs to a PicDeck account and email delivery is available, a reset link will arrive shortly.";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  // Always give the same response so this endpoint cannot reveal account emails.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: true as const, message: RESET_REQUEST_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return { ok: true as const, message: RESET_REQUEST_MESSAGE };

  const now = new Date();
  const token = createPasswordResetToken();
  const reset = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: passwordResetTokenHash(token),
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    },
    select: { id: true },
  });

  const result = await sendEmail({
    to: user.email,
    subject: "Reset your PicDeck password",
    text: `Use this link to reset your PicDeck password: ${appUrl()}/reset-password/${token}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can safely ignore this email.`,
  });
  if (!result.sent) {
    await prisma.passwordResetToken.delete({ where: { id: reset.id } }).catch(() => null);
  } else {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: reset.id } } });
  }
  return { ok: true as const, message: RESET_REQUEST_MESSAGE };
}

export async function resetPassword(token: string, formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("password_confirmation") || "");
  const fail = (message: string) => ({ ok: false as const, message });
  if (password.length < 8) return fail("Password must be at least 8 characters");
  if (password !== confirm) return fail("Passwords do not match");
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return fail("This reset link is invalid or has expired");

  const now = new Date();
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: passwordResetTokenHash(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= now.getTime()) {
    return fail("This reset link is invalid or has expired");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } });
    await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId, id: { not: reset.id } } });
    return true;
  });
  if (!updated) return fail("This reset link is invalid or has expired");

  await createSession(reset.userId);
  return { ok: true as const, redirectTo: "/dashboard" };
}

export async function logoutAction() {
  const { destroySession } = await import("@/lib/auth");
  await destroySession();
  redirect("/");
}
