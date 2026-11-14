"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginUser(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Link href="/"><Logo /></Link>
      </div>
      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-1.5 text-sm text-muted">Use your email or phone number.</p>
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="email">Email or phone</label>
            <input
              id="email"
              name="email"
              required
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {pending ? "Logging in…" : "Log in"}
          </button>
        </form>
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        New to PicDeck?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link>
      </p>
    </div>
  );
}