"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from 'lucide-react';


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