'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function VenueRefreshButton() {
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleRefresh = async () => {
        if (isRefreshing) {
            return;
        }

        setIsRefreshing(true);
        try {
            await fetch('/api/cache/catalog', {
                method: 'POST',
                cache: 'no-store',
            });
        } finally {
            setIsRefreshing(false);
            startTransition(() => {
                router.refresh();
            });
        }
    };

    const isBusy = isRefreshing || isPending;

    return (
        <button
            type="button"
            onClick={handleRefresh}
            disabled={isBusy}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-text transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh venue data"
        >
            {isBusy ? 'Refreshing...' : 'Refresh data'}
        </button>
    );
}
