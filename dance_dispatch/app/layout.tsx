import type { Metadata } from "next";
import type { Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "../app/globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthContextProvider } from "./providers/AuthContext";
import { Header } from "./components/Header";
import { PWARegister } from "./components/PWARegister";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { PushNotificationPrompt } from "./components/PushNotificationPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DanceDispatch",
  description: "Find your next dance party",  
  applicationName: "DanceDispatch",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DanceDispatch",
  },
  icons: {
    icon: [
      { url: "/icons/icon_1.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon_1.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/icon_1.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#06b6d4" },
    { media: "(prefers-color-scheme: dark)", color: "#22d3ee" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthContextProvider>
            <PWARegister />
            <PWAInstallPrompt />
            <PushNotificationPrompt />
            <Suspense fallback={null}>
              <Header />
            </Suspense>
            {children}
          </AuthContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
