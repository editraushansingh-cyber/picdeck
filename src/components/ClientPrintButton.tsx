"use client";

/** Print button for pages the client sees; there is no dashboard to link back to. */
export function ClientPrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
    >
      {label}
    </button>
  );
}
