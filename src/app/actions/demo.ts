"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

/**
 * Developer convenience: signing in without the studio form is only enabled on a
 * local/dev build (DEMO_MODE="on", which `OTP_MODE="console"` also implies). In a
 * real deployment the flag is absent and this action refuses to run.
 */
function demoAllowed() {
  return process.env.DEMO_MODE === "on" || process.env.OTP_MODE === "console";
}

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@picdeck.local";

export async function demoLogin() {
  if (!demoAllowed()) redirect("/login");

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      name: "Demo Studio",
      email: DEMO_EMAIL,
      phone: "+919000000000",
      passwordHash: "demo-not-a-real-password",
      profession: "photographer",
      city: "Jaipur",
      referralCode: "DEMO01",
      phoneVerifiedAt: new Date(),
    },
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function demoLogoutBack() {
  await destroySession();
  redirect("/");
}