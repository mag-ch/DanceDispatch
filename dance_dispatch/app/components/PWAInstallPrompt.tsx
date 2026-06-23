"use client";

import { useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

// Chrome / Edge / Samsung Internet expose a non-standard event for installation.
// TypeScript omits this shape, so we augment it here.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISMISS_UNTIL_KEY = "dd_install_prompt_dismiss_until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Browser / platform detection helpers ─────────────────────────────────────

function getInstallContext(): {
  isIOS: boolean;
  isAndroid: boolean;
  isSamsungBrowser: boolean;
  isFirefoxMobile: boolean;
  supportsBeforeInstallPrompt: boolean; // known to fire (Chrome/Edge/Samsung)
} {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isAndroid: false,
      isSamsungBrowser: false,
      isFirefoxMobile: false,
      supportsBeforeInstallPrompt: false,
    };
  }

  const ua = window.navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isSamsungBrowser = /SamsungBrowser/i.test(ua);
  const isFirefoxMobile = /firefox/i.test(ua) && isAndroid;

  // beforeinstallprompt fires reliably in Chromium-based browsers.
  // Samsung Internet also fires it since v12.
  const supportsBeforeInstallPrompt =
    !isIOS && !isFirefoxMobile && (isAndroid || isSamsungBrowser);

  return {
    isIOS,
    isAndroid,
    isSamsungBrowser,
    isFirefoxMobile,
    supportsBeforeInstallPrompt,
  };
}

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

function isDismissedInStorage(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_UNTIL_KEY);
  const ts = Number(raw);
  return !!raw && !Number.isNaN(ts) && Date.now() < ts;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PWAInstallPrompt() {
  // The deferred browser install event (Chromium / Samsung only).
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  // Whether the banner is visible.
  const [hidden, setHidden] = useState(true);

  // Prevent double-tapping the install button.
  const [installing, setInstalling] = useState(false);

  const isStandalone = useMemo(() => isRunningStandalone(), []);
  const ctx = useMemo(() => getInstallContext(), []);

  useEffect(() => {
    // Never show the install prompt when already running as installed PWA.
    if (isStandalone) return;

    // Respect a prior "Not now" dismissal.
    if (!isDismissedInStorage()) setHidden(false);

    // ── Chromium / Samsung: capture the deferred prompt ──────────────────────
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // suppress the browser mini-infobar
      setInstallEvent(e as BeforeInstallPromptEvent);
      if (!isDismissedInStorage()) setHidden(false);
    };

    // ── Any browser: hide banner after successful install ────────────────────
    const onAppInstalled = () => {
      setHidden(true);
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISS_UNTIL_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isStandalone]);

  // ── Install handler ──────────────────────────────────────────────────────────
  //
  // Strategy per browser:
  //   1. Chromium / Samsung (Android) — installEvent.prompt() triggers the
  //      native "Add to Home Screen" sheet programmatically. ✅ automatic
  //   2. iOS Safari — no programmatic API exists; we surface step-by-step
  //      instructions so the user can do it manually via the Share sheet.
  //   3. Firefox for Android — no beforeinstallprompt support; we guide the
  //      user to the browser menu (⋮ → Install / Add to Home Screen).
  //   4. Any other browser — show a generic manual fallback message.
  //
  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);

    if (installEvent) {
      // ── Path 1: Chromium / Samsung — fully automatic ──────────────────────
      try {
        await installEvent.prompt();
        const { outcome } = await installEvent.userChoice;
        if (outcome === "accepted") {
          setHidden(true);
          window.localStorage.removeItem(DISMISS_UNTIL_KEY);
        }
      } catch (err) {
        console.error("PWA install prompt failed:", err);
      }
      setInstalling(false);
      return;
    }

    // ── Paths 2-4: manual guidance (banner already shows the right copy) ──
    // The banner copy (below) already contains the right instructions for each
    // browser, so pressing "Install" when there is no installEvent just keeps
    // the banner open long enough for the user to read them.
    // We do nothing further here — the user follows the on-screen steps.
    setInstalling(false);
  };

  const handleDismiss = () => {
    setHidden(true);
    window.localStorage.setItem(
      DISMISS_UNTIL_KEY,
      String(Date.now() + DISMISS_MS),
    );
  };

  // ── Derive instructional copy for each browser scenario ───────────────────
  const { isIOS, isFirefoxMobile } = ctx;

  const title = "Install DanceDispatch";

  let body: string;
  let showInstallButton = true; // set false when there is truly nothing to tap

  if (installEvent) {
    // Chromium / Samsung — one-tap install available.
    body =
      "Add DanceDispatch to your home screen for faster launch and an app-like experience.";
  } else if (isIOS) {
    // iOS Safari — Share sheet method.
    body =
      'Tap the Share button (□↑) in Safari, then choose "Add to Home Screen" to install.';
    showInstallButton = false; // nothing for the Install button to do; hide it
  } else if (isFirefoxMobile) {
    // Firefox for Android — browser menu method.
    body =
      'Tap the menu (⋮) in Firefox, then select "Install" or "Add to Home Screen".';
    showInstallButton = false;
  } else {
    // Generic Android browser (Opera, Brave, Arc, etc.)
    body =
      'Open your browser menu and look for "Add to Home Screen" or "Install App".';
    showInstallButton = false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ARCHITECTURE NOTE
  // This component only owns install-prompt UX.
  // Service-worker registration lives in app/components/PWARegister.tsx:
  //   navigator.serviceWorker.register("/sw.js", { scope: "/" })
  // That registration is a prerequisite for full PWA capabilities (offline /
  // caching) but is intentionally separate from this component.
  // ─────────────────────────────────────────────────────────────────────────────

  if (hidden || isStandalone) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-default bg-surface/95 backdrop-blur-md p-4 shadow-2xl">
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>

      <div className="mt-3 flex items-center gap-2">
        {showInstallButton && (
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
          Not now
        </button>
      </div>
    </aside>
  );
}
