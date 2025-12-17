//Navigation links, footer, banners, cookie notices, or modals 
import { ReactNode } from "react";
import Link from "next/link";
import "../styles/globals.css"; // global styles

export const metadata = {
  title: "Dance Dispatch",
  description: "Are you ready to dance?",
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <header className="bg-white shadow-md sticky top-0 z-50">
          <div className="container mx-auto flex justify-between items-center p-4">
            <Link href="/">
              <h1 className="text-xl font-bold">{metadata.title}</h1>
            </Link>
            <nav className="space-x-4">
              <Link href="/feed" className="hover:underline">Feed</Link>
              <Link href="/search" className="hover:underline">Search</Link>
              <Link href="/login" className="hover:underline">Login</Link>
            </nav>
          </div>
        </header>

        <main className="container mx-auto my-6 px-4">
          {children} {/* Page content will render here */}
        </main>

        <footer className="bg-white shadow-inner mt-12 py-6">
          <div className="container mx-auto text-center text-sm text-gray-500">
            © 2025 Eventify. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
