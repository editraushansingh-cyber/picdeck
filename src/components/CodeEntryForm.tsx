"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitGalleryCode } from "@/app/actions/gallery";
import { Logo } from "@/components/Logo";

export function CodeEntryForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, "").slice(0, 6));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const autoTried = useRef(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitGalleryCode(formData);
      if (result && !result.ok) setError(result.message);
    });
  }

  // A shared gallery link already contains the code, so try it once on arrival.
  useEffect(() => {
    if (autoTried.current) return;
    if (initialCode.replace(/\D/g, "").length !== 6) return;
    autoTried.current = true;
    formRef.current?.requestSubmit();
  }, [initialCode]);

  return (
    <div className="mx-auto w-full max-w-sm pd-fade-in">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 text-center sm:p-8">
        <h1 className="text-lg font-semibold tracking-tight">Your gallery</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter the 6-digit code your photographer sent you.
        </p>
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700">
            {error}
          </p>
        )}
        <form ref={formRef} action={handleSubmit} className="mt-6">
          <input
            name="code"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-line px-3 py-4 text-center font-mono text-2xl tracking-[0.5em] focus:border-brand focus:outline-none"
            aria-label="6-digit gallery code"
          />
          <button
            type="submit"
            disabled={code.length !== 6 || pending}
            className="mt-4 w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {pending ? "Opening…" : "Open gallery"}
          </button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Codes are unique per event. If yours stopped working, ask your photographer for a new one.
        </p>
      </div>
    </div>
  );
}
