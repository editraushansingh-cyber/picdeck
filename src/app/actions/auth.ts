"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, randomReferralCode } from "@/lib/auth";
import { TRIAL_DAYS } from "@/lib/plans";
import { grantReferralCredit } from "@/lib/referrals";

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

  // Start on the Free plan; paid plans are assigned by the admin or checkout.
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
  if (freePlan) {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: freePlan.id,
        endsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
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

export async function logoutAction() {
  const { destroySession } = await import("@/lib/auth");
  await destroySession();
  redirect("/");
}