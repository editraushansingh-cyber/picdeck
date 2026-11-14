import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in — PicDeck" };

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function LoginPage() {
  await connection();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <LoginForm />
    </div>
  );
}