"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

// Chrome / Edge / Samsung Internet expose a non-standard install event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

const DISMISS_UNTIL_KEY = "dd_install_prompt_dismiss_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isRunningStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

// iPadOS 13+ reports itself as a Mac, so also check for touch support.
function isIOSDevice(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

function isDismissedInStorage(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_UNTIL_KEY);
    const ts = Number(raw);
    return !!raw && !Number.isNaN(ts) && Date.now() < ts;
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    window.localStorage.setItem(
      DISMISS_UNTIL_KEY,
      String(Date.now() + DISMISS_MS),
    );
  } catch {}
}

function clearDismissed() {
  try {
    window.localStorage.removeItem(DISMISS_UNTIL_KEY);
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PWAInstallPrompt() {
  // Deferred install event (Android / Chromium only).
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [hidden, setHidden] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = isRunningStandalone();
    const ios = isIOSDevice();
    setIsStandalone(standalone);
    setIsIOS(ios);

    // iOS has no install event, so show the manual instructions directly.
    if (ios && !standalone && !isDismissedInStorage()) setHidden(false);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // suppress the browser mini-infobar
      setInstallEvent(e as BeforeInstallPromptEvent);
      if (!isDismissedInStorage()) setHidden(false);
    };

    const onAppInstalled = () => {
      setHidden(true);
      setInstallEvent(null);
      clearDismissed();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installing || !installEvent) return;
    setInstalling(true);

    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      // The event can only be used once.
      setInstallEvent(null);
      setHidden(true);
      if (outcome === "accepted") clearDismissed();
      else setDismissed();
    } catch (err) {
      console.error("PWA install prompt failed:", err);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setHidden(true);
    setDismissed();
  };

  // Show the native prompt (Android) or instructions (iOS), otherwise nothing.
  const canPromptNatively = !!installEvent;
  const showIOSInstructions = isIOS && !installEvent;

  if (hidden || isStandalone || (!canPromptNatively && !showIOSInstructions)) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] max-w-sm rounded-xl border border-default bg-surface/40 dark:bg-surface/40 backdrop-blur-md p-4 shadow-2xl"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <p className="text-sm font-semibold text-text">Install DanceDispatch</p>

      {canPromptNatively ? (
        <p className="mt-1 text-sm text-muted">
          Add DanceDispatch to your home screen for faster launch and an
          app-like experience.
        </p>
      ) : (
        <ol className="mt-1 list-decimal pl-5 text-sm text-muted space-y-1">
          <li>
            Tap the <span className="font-semibold">Share</span> button (the
            square with an arrow) in your browser toolbar.
          </li>
          <li>
            Choose <span className="font-semibold">Add to Home Screen</span>.
          </li>
          <li>
            Tap <span className="font-semibold">Add</span>.
          </li>
        </ol>
      )}

      <div className="mt-3 flex items-center gap-2">
        {canPromptNatively && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="btn-highlighted rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {installing ? "Installing…" : "Install"}
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md border border-default px-4 py-2 text-sm font-semibold hover-bg-accent-soft"
        >
          {canPromptNatively ? "Not now" : "Got it"}
        </button>
      </div>
    </aside>
  );
}