"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from 'lucide-react';

// In React 19 / Next.js 16+, next-themes renders an inline <script> to prevent theme flicker on SSR.
// React 19 emits a dev error when a script tag is encountered during client rendering.
// Filter this known benign development warning so it does not trigger the error overlay.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}


export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-sm"
      aria-label="Toggle theme"
    >
      {isDark ? (
                <Sun className="h-5 w-5 text-white" />
            ) : (
                <Moon className="h-5 w-5 text-black" />
            )}
    </button>
  );
}