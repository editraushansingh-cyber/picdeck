"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGalleryStream } from "@/components/useGalleryStream";

/**
 * Live selection badge for the studio page header and the selection panel.
 * Counts update the instant a client picks or unpicks a photo, and the router
 * is refreshed so downloads and lists stay in step.
 */
export function LiveSelectionSummary({
  eventId,
  initialCount,
  className,
}: {
  eventId: string;
  initialCount: number;
  className?: string;
}) {
  const router = useRouter();
  // Live count wins when present; a server refresh that changes `initialCount`
  // (router.refresh after our own debounce) resets it without an effect.
  const [live, setLive] = useState<{ count: number; at: string } | null>(null);
  const [syncedFrom, setSyncedFrom] = useState(initialCount);
  if (syncedFrom !== initialCount) {
    setSyncedFrom(initialCount);
    setLive(null);
  }
  const count = live?.count ?? initialCount;
  const updatedAt = live?.at ?? null;
  const [bump, setBump] = useState(false);

  const { status } = useGalleryStream({
    eventId,
    onEvent: (event) => {
      // "ping" means the polling fallback is asking for a re-sync; the server
      // render refreshes via the same debounce the stream uses.
      if (event.kind === "ping") {
        setLive((current) => ({ count: current?.count ?? initialCount, at: event.at }));
        return;
      }
      setLive({ count: event.photoIds.length, at: event.at });
      setBump(true);
    },
  });

  useEffect(() => {
    if (!bump) return;
    const timer = setTimeout(() => setBump(false), 1200);
    return () => clearTimeout(timer);
  }, [bump]);

  useEffect(() => {
    if (!updatedAt) return;
    const timer = setTimeout(() => router.refresh(), 900);
    return () => clearTimeout(timer);
  }, [updatedAt, router]);

  return (
    <span className={className} data-live={status}>
      <span className={bump ? "font-semibold text-brand transition" : "transition"}>
        {count} selected
      </span>
    </span>
  );
}