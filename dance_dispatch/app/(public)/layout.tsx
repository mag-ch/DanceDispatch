//Navigation links, footer, banners, cookie notices, or modals 
import { ReactNode } from "react";

export const metadata = {
  title: "Dance Dispatch",
  description: "Are you ready to dance?",
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="bg-bg container mx-auto">
        {children} {/* Page content will render here */}
      </main>
    </>
  );
}
