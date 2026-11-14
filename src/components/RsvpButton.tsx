"use client";

import { useState, useTransition } from "react";
import { rsvpToInvitation } from "@/app/actions/site";

export function RsvpButton({ slug, initialCount }: { slug: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-8">
      <button
        type="button"
        disabled={pending || done}
        onClick={() =>
          startTransition(async () => {
            const result = await rsvpToInvitation(slug);
            if (result.ok) {
              setCount(result.count);
              setDone(true);
            }
          })
        }
        className="rounded-full bg-current px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white opacity-90 hover:opacity-100 disabled:opacity-50"
        style={{ backgroundColor: "var(--rsvp, #3f3527)" }}
      >
        {done ? "Thank you" : pending ? "Sending…" : "RSVP"}
      </button>
      <p className="mt-2 text-[11px] opacity-50">
        {count} {count === 1 ? "guest has" : "guests have"} responded
      </p>
    </div>
  );
}