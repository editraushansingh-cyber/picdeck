import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";

const SESSION_COOKIE = "picdeck_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function secret() {
  return process.env.AUTH_SECRET || "picdeck-dev-secret-change-me";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

function decode(token: string): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = sign(b64);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [userId, issued] = Buffer.from(b64, "base64url").toString().split(".");
  if (!userId || !issued) return null;
  if (Date.now() - Number(issued) > SESSION_TTL_SECONDS * 1000) return null;
  return userId;
}

export async function createSession(userId: string) {
  const token = encode(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decode(token);
}

export async function getCurrentUser() {
  const id = await getUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function randomReferralCode() {
  return "PD" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

export function generateGalleryCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string, phone: string) {
  return crypto.createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}