import Link from "next/link";
import { Logo } from "./Logo";
import { CopyrightYear } from "./CopyrightYear";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="PicDeck home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <Link href="/plans" className="hover:text-ink">Plans</Link>
          <Link href="/about" className="hover:text-ink">About</Link>
          <Link href="/g" className="hover:text-ink">I have a code</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-ink sm:block">
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-56 text-sm leading-relaxed text-muted">
            Photo selection for wedding and event photographers. Built to make the client review
            the easiest part of the shoot.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link href="/plans" className="hover:text-ink">Plans</Link></li>
            <li><Link href="/register" className="hover:text-ink">Create account</Link></li>
            <li><Link href="/g" className="hover:text-ink">Client gallery</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Company</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link href="/about" className="hover:text-ink">About</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Support</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>Monday–Saturday, 10:00–19:00 IST</li>
            <li>support@picdeck.example</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© <CopyrightYear /> PicDeck</p>
          <p>Your photos stay yours. Delete an event and its files are removed with it.</p>
        </div>
      </div>
    </footer>
  );
}
