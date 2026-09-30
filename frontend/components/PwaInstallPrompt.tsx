"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "mt_pwa_install_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    if (ios) {
      setIosHint(true);
      setOpen(true);
      return;
    }

    const onReady = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onReady);
    return () => window.removeEventListener("beforeinstallprompt", onReady);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    dismiss();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <img
          src="/images/mt-estates-logo.png"
          alt="MT Estates"
          className="mx-auto h-16 w-16 object-contain"
        />
        <h2 className="mt-3 text-lg font-extrabold text-mt-blue">Install MT Estates</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add the app to your home screen for quicker access to listings and billing.
        </p>
        {iosHint ? (
          <p className="mt-3 text-xs text-slate-500">
            On iPhone: tap Share, then <strong>Add to Home Screen</strong>.
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          {!iosHint && deferred ? (
            <button
              type="button"
              onClick={install}
              className="rounded-lg bg-mt-blue px-4 py-2.5 text-sm font-semibold text-white"
            >
              Install
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
