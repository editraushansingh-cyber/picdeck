import Link from "next/link";
import { demoLogin } from "@/app/actions/demo";
import { Logo } from "@/components/Logo";

export function DemoEntry() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
          Developer mode
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Open the dashboard directly</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Skips the studio sign-up form. A demo studio is created on first use, with sample
          events, photos and client selections.
        </p>

        <form action={demoLogin} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Enter demo dashboard
          </button>
        </form>

        <div className="mt-6 border-t border-line pt-4 text-xs text-muted">
          <p>
            This button only exists on a local/dev build (when{" "}
            <code className="font-mono">DEMO_MODE=&quot;on&quot;</code>). It is never enabled in
            production.
          </p>
          <p className="mt-2">
            Normal flow:{" "}
            <Link href="/register" className="text-ink underline">Register</Link>
            {" · "}
            <Link href="/login" className="text-ink underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}