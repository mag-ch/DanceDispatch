'use client';

import { useMemo, useState, type ReactNode, Children } from 'react';
import Link from 'next/link';
import SearchableListModal from './SearchableListModal';

interface CollapsedSectionModalProps {
    title: string;
    count: number;
    emptyMessage: string;
    discoverHref: string;
    discoverLabel: string;
    /** Already-rendered items (e.g. <SearchResult /> elements) */
    children: ReactNode;
    modalChildren?: ReactNode;
}

export default function CollapsedSectionModal({
    title,
    count,
    emptyMessage,
    discoverHref,
    discoverLabel,
    children,
    modalChildren,
}: CollapsedSectionModalProps) {
    const [open, setOpen] = useState(false);
    const items = useMemo(() => Children.toArray(children), [children]);

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

            {open && <SearchableListModal title={title} count={count} emptyMessage={emptyMessage} onClose={() => setOpen(false)}>
                {modalChildren ?? children}
            </SearchableListModal>}
        </section>
    );
}
