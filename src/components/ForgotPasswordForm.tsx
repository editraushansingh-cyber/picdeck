"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => setMessage((await requestPasswordReset(formData)).message));
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div>
      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted">Enter the email address used for your studio account.</p>
        {message && <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        <form action={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {pending ? "Sending link…" : "Email reset link"}
          </button>
        </form>
      </div>
      <p className="mt-5 text-center text-sm text-muted"><Link href="/login" className="font-medium text-brand hover:underline">Back to log in</Link></p>
    </div>
  );
}
