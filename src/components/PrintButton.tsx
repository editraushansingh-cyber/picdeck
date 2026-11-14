"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
    >
      Print / Save as PDF
    </button>
  );
}