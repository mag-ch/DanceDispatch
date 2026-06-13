"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    // if (process.env.NODE_ENV === "development") {
    //   return;
    // }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("Service worker registered successfully", registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update().catch(console.error);
        }, 60000); // Check every minute
      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    // Register after a short delay to ensure page stability
    if (document.readyState === "loading") {
      window.addEventListener("load", () => void setTimeout(register, 0));
    } else {
      void setTimeout(register, 0);
    }
  }, []);

  return null;
}
