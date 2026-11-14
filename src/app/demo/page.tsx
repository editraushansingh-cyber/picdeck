import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DemoEntry } from "@/components/DemoEntry";

export const metadata: Metadata = { title: "Demo login — PicDeck" };

export const instant = false;

/** Local shortcut into the dashboard while the studio form is not in use. */
export default async function DemoPage() {
  await connection();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-12">
      <DemoEntry />
    </div>
  );
}