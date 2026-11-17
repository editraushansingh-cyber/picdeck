import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { RegisterForm } from "@/components/RegisterForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account — PicDeck",
  description: "Create a PicDeck studio account with your email and password.",
};

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function RegisterPage() {
  await connection();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <RegisterForm />
    </div>
  );
}
