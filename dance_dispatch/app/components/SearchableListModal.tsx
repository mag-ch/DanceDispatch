'use client';

import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

interface SearchableListModalProps {
    title: string;
    count: number;
    emptyMessage: string;
    onClose: () => void;
    children: ReactNode;
}

function getSearchableLabel(child: ReactNode): string {
    if (!isValidElement(child)) return '';
    const props = child.props as Record<string, unknown>;
    return `${String(props.header ?? '')} ${String(props.subheader ?? '')}`.toLowerCase();
}

export default function SearchableListModal({ title, count, emptyMessage, onClose, children }: SearchableListModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const titleId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const items = useMemo(() => Children.toArray(children), [children]);
    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return term ? items.filter((item) => getSearchableLabel(item).includes(term)) : items;
    }, [items, searchTerm]);

    useEffect(() => {
        const dialog = dialogRef.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={(event) => { event.preventDefault(); onClose(); }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX < bounds.left || event.clientX > bounds.right ||
                    event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
            }}
            className="m-auto w-[calc(100%-2rem)] max-w-[75vw] max-h-[75vh] overflow-y-auto rounded-lg bg-surface p-6 text-text shadow-xl backdrop:bg-black/50"
        >
            <div className="sticky top-0 mb-4 flex items-center justify-between bg-surface pb-3">
                <h3 id={titleId} className="text-xl font-semibold text-text">{title} ({count})</h3>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="px-2 text-2xl leading-none text-text hover:opacity-70">
                    &times;
                </button>
            </div>
            <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                aria-label={`Search ${title.toLowerCase()}`}
                className="mb-4 w-full rounded-md border border-default bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-3">
                {items.length === 0 ? (
                    <p className="text-sm text-muted">{emptyMessage}</p>
                ) : filteredItems.length === 0 ? (
                    <p className="text-sm text-muted">No matches found.</p>
                ) : filteredItems}
            </div>
        </dialog>
    );
}
