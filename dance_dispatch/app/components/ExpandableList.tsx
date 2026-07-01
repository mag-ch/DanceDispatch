'use client';

import { useState, ReactNode } from 'react';

interface ExpandableListProps {
    /** Array of already-rendered items (e.g. <SearchResult /> or <DisplayEventReview /> elements) */
    items: ReactNode[];
    /** How many items to show before collapsing the rest, defaults to 5 */
    initialCount?: number;
    emptyMessage?: string;
    /** Wrapper classes applied around the visible items list, defaults to vertical stack */
    className?: string;
}

export default function ExpandableList({
    items,
    initialCount = 5,
    emptyMessage = 'Nothing here yet',
    className = 'space-y-4',
}: ExpandableListProps) {
    const [expanded, setExpanded] = useState(false);

    if (items.length === 0) {
        return <p className="text-text">{emptyMessage}</p>;
    }

    const visibleItems = expanded ? items : items.slice(0, initialCount);
    const hiddenCount = items.length - initialCount;
    const hasMore = hiddenCount > 0;

    return (
        <div>
            <div className={className}>{visibleItems}</div>
            {hasMore && (
                <button
                    onClick={() => setExpanded((prev) => !prev)}
                    className="mt-4 text-sm font-semibold text-text underline hover:opacity-80"
                >
                    {expanded ? 'See less' : `See more (${hiddenCount} more)`}
                </button>
            )}
        </div>
    );
}
