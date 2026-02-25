'use client';

// components/CustomLink.js
import Link from 'next/link';
import React from 'react';

interface CustomLinkProps {
  href: string;
  children: React.ReactNode;
  [key: string]: any;
}

const CustomLink = ({ href, children, ...props }: CustomLinkProps) => {
  const handleClick = (event: { ctrlKey: any; metaKey: any; shiftKey: any; preventDefault: () => void; }) => {
    // Check if Ctrl key (Windows/Linux) or Cmd key (macOS) or Shift key is pressed
    const isModifierPressed = event.ctrlKey || event.metaKey || event.shiftKey;

    if (isModifierPressed) {
      // Prevent Next.js's internal navigation
      event.preventDefault();
      // Open the link in a new tab
      window.open(href, '_blank');
    }
    // If no modifier is pressed, default Link behavior takes over (client-side routing)
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
       {children}
    </Link>
  );
};

export default CustomLink;
