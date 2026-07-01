'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';

interface CollapsedSectionModalProps {
    title: string;
    count: number;
    emptyMessage: string;
    discoverHref: string;
    discoverLabel: string;
    /** Grid of already-rendered items (e.g. <SearchResult /> elements) */
    children: ReactNode;
    /** Optional grid column classes, defaults to the standard 1/2/3 col layout */
    gridClassName?: string;
}

export default function CollapsedSectionModal({
    title,
    count,
    emptyMessage,
    discoverHref,
    discoverLabel,
    children,
    gridClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
}: CollapsedSectionModalProps) {
    const [open, setOpen] = useState(false);

    // Close on escape key
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

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

            {count === 0 && (
                <div>
                    <p className="text-text">{emptyMessage}</p>
                    <Link
                        className="btn-highlight bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10 w-fit"
                        href={discoverHref}
                    >
                        {discoverLabel}
                    </Link>
                </div>
            )}

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="bg-surface rounded-lg max-w-5xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 sticky top-0 bg-surface">
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
                        <div className={gridClassName}>{children}</div>
                    </div>
                </div>
            )}
        </section>
    );
}
