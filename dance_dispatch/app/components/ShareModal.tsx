
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthContext';
import { Copy, Loader2, Search, Send, Share2, UserPlus, X } from 'lucide-react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    entity: string;
    entityId: string;
    entityTitle?: string;
    eventStartAt?: string | null;
    initialSaved?: boolean;
}

type ShareRecipient = {
    id: string;
    username: string;
    full_name?: string | null;
};

const ENTITY_SEGMENTS: Record<string, string> = {
    event: 'events',
    events: 'events',
    host: 'hosts',
    hosts: 'hosts',
    venue: 'venues',
    venues: 'venues',
    user: 'users',
    users: 'users',
};

function normalizeEntityType(entity: string): string {
    const normalized = entity.trim().toLowerCase();
    return normalized in ENTITY_SEGMENTS ? normalized : normalized.replace(/s$/, '');
}

function getEntityPath(entity: string, entityId: string): string {
    const normalized = normalizeEntityType(entity);
    const segment = ENTITY_SEGMENTS[normalized] ?? `${normalized}s`;
    return `/${segment}/${encodeURIComponent(entityId)}`;
}

function getEntityLabel(entity: string): string {
    const normalized = normalizeEntityType(entity);
    if (normalized === 'event') return 'event';
    if (normalized === 'host') return 'DJ';
    if (normalized === 'venue') return 'venue';
    if (normalized === 'user') return 'profile';
    return normalized;
}

function buildEventPrompt(eventStartAt?: string | null): string {
    if (!eventStartAt) {
        return 'Share it with friends so they can open the event page and decide whether to go.';
    }

    const startTs = Date.parse(eventStartAt);
    if (Number.isNaN(startTs)) {
        return 'Share it with friends so they can open the event page and decide whether to go.';
    }

    if (startTs <= Date.now()) {
        return 'Friends already on DanceDispatch can open the event page and leave a review.';
    }

    return 'Friends already on DanceDispatch can open the event page and RSVP.';
}

function buildGuestPrompt(eventStartAt?: string | null): string {
    if (!eventStartAt) {
        return 'Anyone without an account can use the link to sign up and open the event page.';
    }

    const startTs = Date.parse(eventStartAt);
    if (Number.isNaN(startTs) || startTs <= Date.now()) {
        return 'Anyone without an account can use the link to sign up and open the event page.';
    }

    return 'Anyone without an account can use the link to sign up, view the event, and RSVP.';
}

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    entity,
    entityId,
    entityTitle,
    eventStartAt,
}) => {

    // sends a user a notification that says their friends have shared an event with them.
    // if the event is passed and they're already a user, they can leave a review on the event page
    // if the event is upcoming and they're already a user, they can rsvp
    // if theyre not a user, they can sign up to view the event and rsvp
    const { session, loading: authLoading } = useAuth();
    const [shareUrl, setShareUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<ShareRecipient[]>([]);
    const [selectedRecipients, setSelectedRecipients] = useState<ShareRecipient[]>([]);
    const [note, setNote] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');
    const [shareState, setShareState] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const entityPath = useMemo(() => getEntityPath(entity, entityId), [entity, entityId]);
    const entityLabel = useMemo(() => getEntityLabel(entity), [entity]);
    const internalPrompt = entityLabel === 'event' ? buildEventPrompt(eventStartAt) : `Friends on DanceDispatch can open this ${entityLabel} directly.`;
    const guestPrompt = entityLabel === 'event' ? buildGuestPrompt(eventStartAt) : `Anyone without an account can use the link to sign up and open this ${entityLabel}.`;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setShareUrl(`${window.location.origin}${entityPath}`);
    }, [entityPath]);

    useEffect(() => {
        if (!isOpen || !session || authLoading) {
            setResults([]);
            return;
        }

        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery.length < 2) {
            setResults([]);
            return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/share/users?query=${encodeURIComponent(trimmedQuery)}`, {
                    signal: controller.signal,
                    cache: 'no-store',
                });

                if (!response.ok) {
                    throw new Error('Unable to search for users right now.');
                }

                const data = (await response.json()) as ShareRecipient[];
                const selectedIds = new Set(selectedRecipients.map((recipient) => recipient.id));
                setResults(
                    (Array.isArray(data) ? data : []).filter((recipient) => !selectedIds.has(recipient.id))
                );
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    setResults([]);
                }
            } finally {
                setIsSearching(false);
            }
        }, 250);

        return () => {
            controller.abort();
            window.clearTimeout(timeoutId);
        };
    }, [authLoading, isOpen, searchQuery, selectedRecipients, session]);

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setResults([]);
            setSelectedRecipients([]);
            setNote('');
            setErrorMessage(null);
            setShareState('idle');
            setCopyState('idle');
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopyState('done');
            window.setTimeout(() => setCopyState('idle'), 1600);
        } catch {
            setErrorMessage('Copy failed. You can still copy the link manually.');
        }
    };

    const handleNativeShare = async () => {
        if (!navigator.share) {
            await handleCopy();
            return;
        }

        try {
            await navigator.share({
                title: entityTitle ?? `DanceDispatch ${entityLabel}`,
                text: entityTitle ? `Check out ${entityTitle} on DanceDispatch.` : 'Check this out on DanceDispatch.',
                url: shareUrl,
            });
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                setErrorMessage('Sharing failed. Try copying the link instead.');
            }
        }
    };

    const handleAddRecipient = (recipient: ShareRecipient) => {
        setSelectedRecipients((current) => {
            if (current.some((entry) => entry.id === recipient.id)) {
                return current;
            }

            return [...current, recipient];
        });
        setResults((current) => current.filter((entry) => entry.id !== recipient.id));
        setSearchQuery('');
        setErrorMessage(null);
    };

    const handleRemoveRecipient = (recipientId: string) => {
        setSelectedRecipients((current) => current.filter((recipient) => recipient.id !== recipientId));
    };

    const handleSend = async () => {
        if (selectedRecipients.length === 0) {
            setErrorMessage('Choose at least one friend to notify.');
            return;
        }

        setIsSending(true);
        setErrorMessage(null);
        setShareState('idle');

        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entity,
                    entityId,
                    note,
                    recipientUserIds: selectedRecipients.map((recipient) => recipient.id),
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to send shares right now.');
            }

            setShareState('success');
            setSelectedRecipients([]);
            setNote('');
            setResults([]);
            setSearchQuery('');
        } catch (error) {
            setShareState('error');
            setErrorMessage(error instanceof Error ? error.message : 'Unable to send shares right now.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-6" onClick={onClose}>
            <div
                className="w-full max-w-2xl rounded-2xl border border-default bg-surface p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Share"
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">Share</p>
                        <h2 className="text-2xl font-bold text-text">{entityTitle ? entityTitle : `This ${entityLabel}`}</h2>
                        <p className="mt-2 text-sm text-muted">{internalPrompt}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-muted transition hover:bg-slate-100 hover:text-text dark:hover:bg-slate-800"
                        aria-label="Close share modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-xl border border-default bg-bg/40 p-4">
                        <div className="mb-3 flex items-center gap-2 text-text">
                            <Share2 className="h-4 w-4" />
                            <h3 className="font-semibold">Share by link</h3>
                        </div>
                        <p className="mb-4 text-sm text-muted">{guestPrompt}</p>
                        <div className="rounded-xl border border-default bg-surface p-3">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Direct link</p>
                            <p className="break-all text-sm text-text">{shareUrl}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex items-center gap-2 rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <Copy className="h-4 w-4" />
                                {copyState === 'done' ? 'Copied' : 'Copy link'}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleNativeShare()}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                <Share2 className="h-4 w-4" />
                                Share
                            </button>
                        </div>
                    </section>

                    <section className="rounded-xl border border-default bg-bg/40 p-4">
                        <div className="mb-3 flex items-center gap-2 text-text">
                            <Send className="h-4 w-4" />
                            <h3 className="font-semibold">Send to friends</h3>
                        </div>

                        {!session ? (
                            <div className="rounded-xl border border-dashed border-default bg-surface p-4">
                                <p className="text-sm text-muted">
                                    Log in to send an in-app notification to friends. They&apos;ll get a notification with a direct link back here.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <Link
                                        href="/auth/login"
                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Log in
                                    </Link>
                                    <Link
                                        href="/auth/signup"
                                        className="inline-flex items-center gap-2 rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        Sign up
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <>
                                <label className="mb-2 block text-sm font-medium text-text">Find a friend by username</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        placeholder="Start typing a username"
                                        className="w-full rounded-lg border border-default bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none transition focus:border-blue-500"
                                    />
                                </div>
                                <div className="mt-2 min-h-10">
                                    {isSearching ? (
                                        <div className="flex items-center gap-2 text-sm text-muted">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Searching users...
                                        </div>
                                    ) : results.length > 0 ? (
                                        <div className="space-y-2">
                                            {results.map((recipient) => (
                                                <button
                                                    key={recipient.id}
                                                    type="button"
                                                    onClick={() => handleAddRecipient(recipient)}
                                                    className="flex w-full items-center justify-between rounded-lg border border-default bg-surface px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-text">@{recipient.username}</p>
                                                        {recipient.full_name ? <p className="text-xs text-muted">{recipient.full_name}</p> : null}
                                                    </div>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">Add</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : searchQuery.trim().length >= 2 ? (
                                        <p className="text-sm text-muted">No matching users found.</p>
                                    ) : null}
                                </div>

                                {selectedRecipients.length > 0 ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {selectedRecipients.map((recipient) => (
                                            <span
                                                key={recipient.id}
                                                className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                                            >
                                                @{recipient.username}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRecipient(recipient.id)}
                                                    className="rounded-full p-0.5 transition hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                    aria-label={`Remove ${recipient.username}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                <label className="mt-4 block text-sm font-medium text-text">Add a note</label>
                                <textarea
                                    value={note}
                                    onChange={(event) => setNote(event.target.value.slice(0, 280))}
                                    rows={3}
                                    placeholder="Optional message"
                                    className="mt-2 w-full rounded-lg border border-default bg-surface p-3 text-sm text-text outline-none transition focus:border-blue-500"
                                />
                                <div className="mt-1 text-right text-xs text-muted">{note.length}/280</div>

                                <button
                                    type="button"
                                    onClick={() => void handleSend()}
                                    disabled={isSending || authLoading}
                                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {isSending ? 'Sending...' : 'Send notification'}
                                </button>
                            </>
                        )}

                        {shareState === 'success' ? (
                            <p className="mt-3 text-sm font-medium text-green-600">Share notification sent.</p>
                        ) : null}
                        {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
                    </section>
                </div>
            </div>
        </div>
    );
};
