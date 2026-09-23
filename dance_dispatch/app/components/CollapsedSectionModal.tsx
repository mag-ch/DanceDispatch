'use client';

import { useEffect, useMemo, useState, ReactNode, Children, isValidElement } from 'react';
import Link from 'next/link';

interface CollapsedSectionModalProps {
    title: string;
    count: number;
    emptyMessage: string;
    discoverHref: string;
    discoverLabel: string;
    /** Already-rendered items (e.g. <SearchResult /> elements) */
    children: ReactNode;
}

// SearchResult (and similar cards) expose their display name via a `header` prop —
// pull it out so the modal's search box can filter without needing raw data separately.
function getSearchableLabel(child: ReactNode): string {
    if (!isValidElement(child)) return '';
    const props = child.props as Record<string, unknown>;
    return String(props?.header ?? props?.subheader ?? '').toLowerCase();
}

export default function CollapsedSectionModal({
    title,
    count,
    emptyMessage,
    discoverHref,
    discoverLabel,
    children,
}: CollapsedSectionModalProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Close on escape key
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    // Reset the filter each time the modal is reopened
    useEffect(() => {
        if (!open) setSearchTerm('');
    }, [open]);

    const items = useMemo(() => Children.toArray(children), [children]);
    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return items;
        return items.filter((item) => getSearchableLabel(item).includes(term));
    }, [items, searchTerm]);

    return (
        <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-text">
                    {title} ({count})
                </h2>
                {count > 0 && (
                    <button
                        onClick={() => setOpen(true)}
                        className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold w-fit"
                    >
                        View All
                    </button>
                )}
            </div>

            {count === 0 ? (
                <div>
                    <p className="text-text">{emptyMessage}</p>
                    <Link
                        className="btn-highlight bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10 w-fit"
                        href={discoverHref}
                    >
                        {discoverLabel}
                    </Link>
                </div>
            ) : (
                // Horizontally scrolling preview strip, below the section header.
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className="w-[220px] shrink-0 snap-start overflow-hidden rounded-lg border border-default bg-surface p-1"
                        >
                            {item}
                        </div>
                    ))}
                </div>
            )}

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="bg-surface rounded-lg w-full max-w-[75vw] max-h-[75vh] overflow-y-auto p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 sticky top-0 bg-surface pb-3">
                            <h3 className="text-xl font-semibold text-text">
                                {title} ({count})
                            </h3>
                            <button
                                onClick={() => setOpen(false)}
                                aria-label="Close"
                                className="text-text text-2xl leading-none px-2 hover:opacity-70"
                            >
                                &times;
                            </button>
                        </div>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`Search ${title.toLowerCase()}...`}
                            className="mb-4 w-full rounded-md border border-default bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="flex flex-col gap-3">
                            {filteredItems.length === 0 ? (
                                <p className="text-sm text-muted">No matches found.</p>
                            ) : (
                                filteredItems
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

