'use client';

import { useState } from 'react';
import type { Event } from "@/lib/utils";

interface ParseEventFromLinkProps {
    onParsed: (data: Event) => void;
    onBack?: () => void;
    onClose?: () => void;
}

export function ParseEventFromLink({ onParsed, onBack, onClose }: ParseEventFromLinkProps) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleParse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/parse-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to parse event');
            }

            onParsed(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="relative w-full max-w-md rounded-xl bg-bg shadow-xl dark:bg-surface">
                {/* Back button */}
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="absolute left-4 top-4 rounded-full p-1 text-muted hover:text-text"
                        aria-label="Back"
                    >
                        <ArrowLeftIcon size={20} />
                    </button>
                )}

                {/* Close button */}
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-text"
                        aria-label="Close"
                    >
                        <XIcon size={20} />
                    </button>
                )}

                <div className="p-6 pt-12">
                    <h2 className="mb-1 text-center text-2xl font-bold text-text">
                        Parse from Link
                    </h2>
                    <p className="mb-6 text-center text-sm text-muted">
                        Paste an event URL and we'll extract the details
                    </p>

                    <form onSubmit={handleParse} className="flex flex-col gap-4">
                        <div>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/event"
                                required
                                disabled={loading}
                                className="w-full rounded-lg border border-default bg-bg px-3 py-2.5 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            />
                        </div>

                        {error && (
                            <p className="rounded-lg bg-red-100 p-3 text-sm text-red-700">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !url.trim()}
                            className="btn-highlighted w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                                    Parsing...
                                </span>
                            ) : (
                                'Parse & Continue'
                            )}
                        </button>
                    </form>

                    {/* Preview of what we'll try to extract */}
                    <div className="mt-6 rounded-lg border border-default p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                            We'll look for:
                        </p>
                        <ul className="space-y-1 text-xs text-muted">
                            <li className="flex items-center gap-2">
                                <CheckIcon size={12} className="text-green-500" />
                                Event title & description
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckIcon size={12} className="text-green-500" />
                                Date & time
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckIcon size={12} className="text-green-500" />
                                Location / venue
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckIcon size={12} className="text-green-500" />
                                Ticket price
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckIcon size={12} className="text-green-500" />
                                Flyer image
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Inline icons (replace with your actual icon imports) ───

function ArrowLeftIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
    );
}

function XIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

function CheckIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function SpinnerIcon({ className = '' }: { className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}