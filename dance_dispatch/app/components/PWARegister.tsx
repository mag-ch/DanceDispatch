"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
         if (
        process.env.NODE_ENV === "production" &&
        "serviceWorker" in navigator
      ) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }      
     } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    void register();
  }, []);

  return null;
}
