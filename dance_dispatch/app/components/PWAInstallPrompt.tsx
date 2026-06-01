"use client";

import { useEffect, useMemo, useState } from "react";

// Chrome/Edge expose a non-standard event object for installation.
// TypeScript does not include this shape by default, so we define it here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// localStorage key used to avoid re-showing the banner immediately after dismissal.
const DISMISS_UNTIL_KEY = "dd_install_prompt_dismiss_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
// Current cooldown for "Not now" before the prompt can reappear.
//const DISMISS_MS = 3 * 60 * 1000;

// Reads dismissal state from localStorage and checks whether the cooldown is active.
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
  // Stores the browser-provided install event captured from "beforeinstallprompt".
  // If this is null, browser-driven install prompt is not currently available.
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // Controls whether the UI banner is rendered.
  const [hidden, setHidden] = useState(true);

  // Prevents duplicate install attempts while prompt/user choice is in progress.
  const [installing, setInstalling] = useState(false);

  // Detect if app is already running as an installed PWA.
  // If true, this component stays hidden permanently in that session.
  const isStandalone = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  }, []);

  // iOS Safari does not support beforeinstallprompt, so we show manual instructions.
  const isIOS = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }, []);

  useEffect(() => {
    // Browser-only guard.
    if (typeof window === "undefined") {
      return;
    }

    // If already installed/running standalone, never show install UI.
    if (isStandalone) {
      setHidden(true);
      return;
    }

    // Respect prior dismissal cooldown persisted in localStorage.
    const isDismissed = isDismissedInStorage();
    setHidden(isDismissed);

    // Fires when browser decides the app is installable.
    // We prevent default mini-infobar and store the event for our custom button.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);

      // Show prompt UI only if user is not within dismissal cooldown.
      if (!isDismissedInStorage()) {
        setHidden(false);
      }
    };

    // Fires after successful installation from any flow.
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

  // Programmatic install entry point:
  // This function is called by the Install button click.
  // The actual browser install dialog is triggered at installEvent.prompt().
  const handleInstall = async () => {
    if (installing) {
      return;
    }

    setInstalling(true);

    if (installEvent) {
      try {
        // This is the exact line that programmatically invokes PWA installation UX.
        // Browser may show a native dialog/sheet based on platform support.
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

  // User chose to postpone install. We hide prompt and store cooldown.
  const handleDismiss = () => {
    setHidden(true);
    window.localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + DISMISS_MS));
  };

  // Nothing to render if hidden or already standalone-installed.
  if (hidden || isStandalone) {
    return null;
  }

  // IMPORTANT ARCHITECTURE NOTE:
  // This component does not register the service worker.
  // Service worker registration is handled in app/components/PWARegister.tsx via:
  //   navigator.serviceWorker.register("/sw.js", { scope: "/" })
  // That registration is a prerequisite for full PWA capabilities (offline/caching),
  // while THIS component focuses on the install prompt UX and install button behavior.
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