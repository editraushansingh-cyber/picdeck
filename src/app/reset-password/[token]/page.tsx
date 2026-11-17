import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password — PicDeck" };
export const instant = false;

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) notFound();
  return <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-12"><ResetPasswordForm token={token} /></main>;
}
