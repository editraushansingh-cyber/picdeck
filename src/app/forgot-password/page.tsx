import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password — PicDeck" };

export default function ForgotPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-12"><ForgotPasswordForm /></main>;
}
