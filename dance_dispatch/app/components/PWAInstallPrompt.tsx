"use client";

import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_UNTIL_KEY = "dd_install_prompt_dismiss_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
// const DISMISS_MS = 3 * 60 * 1000;

function isDismissedInStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  const storedUntil = window.localStorage.getItem(DISMISS_UNTIL_KEY);
  const untilTs = Number(storedUntil);

  if (!storedUntil || Number.isNaN(untilTs)) {
    return false;
  }

  return Date.now() < untilTs;
}

export function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [installing, setInstalling] = useState(false);

  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }, []);

  const isIOS = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (isStandalone) {
      setHidden(true);
      return;
    }

    const isDismissed = isDismissedInStorage();
    setHidden(isDismissed);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setHidden(true);
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISS_UNTIL_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isStandalone]);

  const handleInstall = async () => {
    if (installing) {
      return;
    }

    setInstalling(true);

    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;

        if (choice.outcome === "accepted") {
          setHidden(true);
          window.localStorage.removeItem(DISMISS_UNTIL_KEY);
        }
      } catch (error) {
        console.error("PWA install failed:", error);
      }
    }

    setInstalling(false);
  };

  const handleDismiss = () => {
    setHidden(true);
    window.localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + DISMISS_MS));
  };

  if (hidden || isStandalone) {
    return null;
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/95 backdrop-blur-md p-4 shadow-2xl">
      <p className="text-sm font-semibold text-text">Install DanceDispatch</p>
      <p className="mt-1 text-sm text-muted">
        {installEvent
          ? "Add DanceDispatch to your home screen for faster launch and app-like browsing."
          : isIOS
            ? "Open Safari Share and tap Add to Home Screen to install this app."
            : "Install this app for faster access and offline support."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {installing ? "Installing..." : "Install"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md border border-default px-4 py-2 text-sm font-semibold hover-bg-accent-soft"
        >
          Not now
        </button>
      </div>
    </aside>
  );
}