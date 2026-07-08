'use client';

import { useRef, useState } from 'react';

type CopyState = 'idle' | 'success' | 'error';

type CopyShareButtonProps = {
  shareUrl: string;
};

export default function CopyShareButton({ shareUrl }: CopyShareButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timeoutRef = useRef<number | null>(null);

  const resetAfterDelay = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setCopyState('idle');
      timeoutRef.current = null;
    }, 2000);
  };

  const copyShareUrl = async () => {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }

    resetAfterDelay();
  };

  return (
    <button
      type="button"
      onClick={copyShareUrl}
      className={`rounded border border-default px-3 py-1.5 text-xs font-semibold text-text hover:bg-accent-soft ${copyState === 'error' ? 'text-red-500' : 'text-text'}`}
    >
      {copyState === 'success' ? '✓ Copied!' : 'Copy Share URL'}
    </button>
  );
}