"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await resetPassword(token, formData);
      if (!result.ok) return setError(result.message);
      router.push(result.redirectTo);
    });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center"><Link href="/"><Logo /></Link></div>
      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted">Use at least 8 characters.</p>
        {error && <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <form action={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="password">New password</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="password_confirmation">Confirm new password</label>
            <input id="password_confirmation" name="password_confirmation" type="password" required minLength={8} autoComplete="new-password" className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none" />
          </div>
          <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {pending ? "Saving password…" : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
