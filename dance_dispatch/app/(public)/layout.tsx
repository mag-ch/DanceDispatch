//Navigation links, footer, banners, cookie notices, or modals 
import { ReactNode } from "react";
import "../styles/globals.css"; // global styles

export const metadata = {
  title: "Dance Dispatch",
  description: "Are you ready to dance?",
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="bg-white container mx-auto my-6 px-4">
        {children} {/* Page content will render here */}
      </main>

      <footer className="bg-white shadow-inner mt-12 py-6">
        <div className="container mx-auto text-center text-sm text-gray-500">
          © 2025 Eventify. All rights reserved.
        </div>
      </footer>
    </>
  );
}
