import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Offline — PicDeck" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-5 text-center">
      <div className="max-w-sm">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">You are offline</h1>
        <p className="mt-2 text-sm text-muted">
          The app shell is saved on this device, but galleries and photos need a connection.
          Reconnect and try again.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
