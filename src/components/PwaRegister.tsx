"use client";

import { useEffect } from "react";

/**
 * Registers the small app-shell service worker that makes PicDeck installable
 * on Android/iOS home screens. Galleries and APIs are never cached by it.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
