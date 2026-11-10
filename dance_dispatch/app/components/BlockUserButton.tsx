'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BlockUserButton({ userId, name, isBlocked }: {
  userId: string;
  name: string;
  isBlocked: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function toggleBlock() {
    if (!isBlocked && !window.confirm(`Block ${name}? You will both be unfollowed and neither of you can follow the other until unblocked.`)) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/users/blocks/${encodeURIComponent(userId)}`, {
        method: isBlocked ? 'DELETE' : 'POST',
      });
      if (!response.ok) throw new Error('Unable to update block. Please try again.');
      router.refresh();
    } catch (err) {
      console.error('Failed to update block:', err);
      setError('Unable to update block. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" disabled={pending} onClick={() => void toggleBlock()}
        className="rounded border border-default px-4 py-2 text-sm text-text hover:border-accent disabled:opacity-50">
        {pending ? 'Working...' : isBlocked ? 'Unblock' : 'Block user'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
