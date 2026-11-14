export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8 15 2.6-3.4 2.2 2.6 1.7-2 2.2 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight">
        Pic<span className="text-brand">Deck</span>
        {!compact && <span className="sr-only"> — the studio suite for photographers</span>}
      </span>
    </span>
  );
}