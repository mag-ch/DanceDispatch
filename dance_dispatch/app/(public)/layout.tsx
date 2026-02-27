//Navigation links, footer, banners, cookie notices, or modals 
import { ReactNode } from "react";

export const metadata = {
  title: "Dance Dispatch",
  description: "Are you ready to dance?",
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="bg-bg container mx-auto my-6 px-4">
        {children} {/* Page content will render here */}
      </main>

      <footer className="bg-bg shadow-inner mt-12 py-6">
        <div className="container mx-auto text-center text-sm text-text">
          © 2025 Eventify. All rights reserved.
        </div>
      </footer>
    </>
  );
}
