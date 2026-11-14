"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Events" },
  { href: "/dashboard/albums", label: "Albums" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/invitations", label: "Invitations" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/referrals", label: "Referrals" },
  { href: "/dashboard/website", label: "Website" },
  { href: "/dashboard/backgrounds", label: "Backgrounds" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/plans", label: "Billing" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto text-sm">
      {LINKS.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === "/dashboard" || pathname.startsWith("/dashboard/events")
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 ${
              active ? "bg-surface font-medium text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}