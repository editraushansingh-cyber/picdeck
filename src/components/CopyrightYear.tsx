"use client";

/**
 * The footer is part of the prerendered shell, so the current year has to be
 * read on the client. React replaces the server value during hydration.
 */
export function CopyrightYear() {
  return <>{new Date().getFullYear()}</>;
}