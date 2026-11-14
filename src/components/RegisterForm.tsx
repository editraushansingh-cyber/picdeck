"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

const COUNTRY_CODES = [
  { code: "+91", label: "India" },
  { code: "+92", label: "Pakistan" },
  { code: "+880", label: "Bangladesh" },
  { code: "+977", label: "Nepal" },
  { code: "+93", label: "Afghanistan" },
  { code: "+971", label: "UAE" },
  { code: "+44", label: "UK" },
  { code: "+1", label: "USA/Canada" },
];

export function RegisterForm() {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setFormError(null);
    formData.set("country_code", countryCode);
    formData.set("phone", phone);
    startTransition(async () => {
      const result = await registerUser(formData);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8 flex justify-center">
        <Link href="/">
          <Logo />
        </Link>
      </div>
      <div className="rounded-2xl border border-line p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Create your studio account</h1>
        <p className="mt-1.5 text-sm text-muted">
          No SMS codes — sign up with your email and password and start on the Free plan.
        </p>

        {formError && (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}

        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="phone">
              Phone number
            </label>
            <div className="mt-1.5 flex gap-2">
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="w-32 rounded-lg border border-line bg-white px-2 py-2.5 text-sm focus:border-brand focus:outline-none"
                aria-label="Country code"
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.code} {country.label}
                  </option>
                ))}
              </select>
              <input
                id="phone"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                required
                pattern="[0-9 ]{7,15}"
                title="7 to 15 digits"
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/[^\d\s]/g, ""))}
                className="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Used only on your invoices and for account recovery — we never send SMS or WhatsApp
              messages.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              required
              autoComplete="name"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-medium">I am a</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                { value: "photographer", label: "Photographer" },
                { value: "other", label: "Other" },
              ].map((option, index) => (
                <label
                  key={option.value}
                  className="has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40 cursor-pointer rounded-lg border border-line px-3 py-2.5 text-center text-sm"
                >
                  <input
                    type="radio"
                    name="profession"
                    value={option.value}
                    defaultChecked={index === 0}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="pin_code">PIN / Postal code</label>
              <input
                id="pin_code"
                name="pin_code"
                maxLength={10}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="billing_address">Address</label>
            <textarea
              id="billing_address"
              name="billing_address"
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="password_confirmation">Confirm password</label>
              <input
                id="password_confirmation"
                name="password_confirmation"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="referral_code">Referral code (optional)</label>
            <input
              id="referral_code"
              name="referral_code"
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 font-mono text-sm uppercase focus:border-brand focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input id="reg-consent" type="checkbox" name="consent" required className="mt-0.5 size-4 accent-[var(--pd-brand)]" />
            <span className="text-muted">
              I agree to the{" "}
              <Link href="/terms" className="text-ink underline">Terms</Link> and{" "}
              <Link href="/privacy" className="text-ink underline">Privacy Policy</Link>.
            </span>
          </label>

          <button
            id="register_submit"
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
      </p>
    </div>
  );
}
