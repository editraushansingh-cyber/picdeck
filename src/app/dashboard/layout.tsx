import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activeSubscription } from "@/lib/plans";
import { Logo } from "@/components/Logo";
import { DashboardNav } from "@/components/DashboardNav";
import { logoutAction } from "@/app/actions/auth";

// This route reads the session cookie, event params or search params on every request.
export const instant = false;

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  // Session checks read cookies and the current time, so this tree renders per request.
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const subscription = await activeSubscription(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-2">
          <div className="flex items-center gap-5">
            <Link href="/dashboard"><Logo /></Link>
            <DashboardNav />
          </div>
          <div className="flex items-center gap-3 text-sm">
            {subscription ? (
              <span className="hidden rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand sm:inline">
                {subscription.plan.name}
                {subscription.endsAt
                  ? ` · ${subscription.endsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                  : " · ongoing"}
              </span>
            ) : (
              <Link href="/plans" className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                No active plan — choose one
              </Link>
            )}
            <span className="hidden text-muted md:inline">{user.name}</span>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
