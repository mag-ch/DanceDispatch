'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { AuthRequiredModal } from '@/app/components/AuthRequiredModal';

interface SaveEventButtonProps {
    eventId: string | number;
    initialSaved?: boolean;
    isDisabled?: boolean;
    showLabel?: boolean;
    onSavedChange?: (isSaved: boolean) => void;
    onReview?: () => void;
}
interface SaveEntityButtonProps {
    entity: string;
    entityId: string | number;
    initialSaved?: boolean;
    isDisabled?: boolean;
    onFollowChange?: (isFollowing: boolean) => void;
    compact?: boolean;
}

interface ActionToastProps {
    message: string;
}

const ActionToast: React.FC<ActionToastProps> = ({ message }) => (
    <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg sm:bottom-5 sm:left-4 sm:w-auto sm:translate-x-0"
    >
        {message}
    </div>
);

const getFollowedEntityLabel = (entity: string) => {
    if (entity === 'users') return 'user';
    if (entity === 'venues') return 'venue';
    if (entity === 'hosts') return 'host';
    return 'entity';
};

export const SaveEventButton: React.FC<SaveEventButtonProps> = ({ eventId, initialSaved, isDisabled, showLabel = false, onSavedChange, onReview }) => {
    const { session, loading: authLoading } = useAuth();
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined && !!session);
    const [loadError, setLoadError] = useState(false);
    const [isPastEvent, setIsPastEvent] = useState(false);
    const [attendanceStep, setAttendanceStep] = useState<'confirm' | 'review' | null>(null);
    const [attendanceError, setAttendanceError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showPopup, setShowPopup] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const isSubmittingRef = useRef(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (message: string) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }

        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
            toastTimerRef.current = null;
        }, 2200);
    };

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        if (authLoading) {
            return () => {
                isMounted = false;
            };
        }

        if (!session) {
            setIsSaved(false);
            setIsLoading(false);
            setLoadError(false);
            return () => {
                isMounted = false;
            };
        }

        setIsLoading(true);
        fetch(`/api/users/saved-events/${eventId}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to check saved state');
                return res.json();
            })
            .then((data) => {
                if (typeof data.isSaved !== 'boolean' || typeof data.isPastEvent !== 'boolean') throw new Error('Invalid saved state response');
                if (isMounted) {
                    setIsSaved(data.isSaved);
                    setIsPastEvent(data.isPastEvent);
                    setIsLoading(false);
                    setLoadError(false);
                }
            })
            .catch((error) => {
                console.error('Error fetching saved state:', error);
                if (isMounted) {
                    setIsLoading(false);
                    setLoadError(true);
                    showToast('Could not load RSVP status');
                }
            });

        return () => {
            isMounted = false;
        };
    }, [eventId, initialSaved, session, authLoading, retryCount]);

    const updateSaved = async (newSavedState: boolean, attendanceConfirmed = false) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setAttendanceError(null);
        try {
            const response = await fetch(`/api/users/saved-events/${eventId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: newSavedState, attendanceConfirmed })
            });
            const payload = await response.json() as { isPastEvent?: boolean; attendanceConfirmationRequired?: boolean; error?: string };
            if (response.status === 409 && payload.attendanceConfirmationRequired) {
                setIsPastEvent(true);
                setAttendanceStep('confirm');
                return;
            }
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to update saved state');
            }
            setIsSaved(newSavedState);
            onSavedChange?.(newSavedState);
            if (typeof payload.isPastEvent === 'boolean') setIsPastEvent(payload.isPastEvent);
            if (newSavedState && payload.isPastEvent) {
                setAttendanceStep('review');
            } else if (newSavedState) {
                showToast("RSVP'ed to event");
            } else {
                showToast(isPastEvent ? 'Removed attendance' : 'Removed from RSVPs');
            }
        } catch (error) {
            console.error('Failed to save event:', error);
            if (attendanceConfirmed) setAttendanceError(error instanceof Error ? error.message : 'Could not mark attendance');
            else showToast('Could not update RSVP');
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDisabled) return;
        if (!session) {
            setShowPopup(true);
        } else if (loadError) {
            setIsLoading(true);
            setRetryCount((count) => count + 1);
        } else if (isPastEvent && !isSaved) {
            setAttendanceError(null);
            setAttendanceStep('confirm');
        } else {
            void updateSaved(!isSaved);
        }
    };

    const actionLabel = loadError ? 'Retry loading RSVP status'
        : isPastEvent ? (isSaved ? 'Remove attendance' : 'Mark as attended')
        : (isSaved ? 'Remove RSVP' : 'RSVP to event');

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                disabled={isLoading || authLoading || isDisabled || isSubmitting}
                className={`group inline-flex items-center gap-2 rounded-full transition ${showLabel ? 'px-4 py-2 text-sm font-semibold' : 'p-2'} ${isDisabled ? 'cursor-not-allowed opacity-40 grayscale' : 'hover:opacity-80'}`}
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                aria-disabled={isLoading || authLoading || isDisabled || isSubmitting}
                aria-pressed={loadError ? undefined : isSaved}
                aria-label={isDisabled ? 'RSVP unavailable' : actionLabel}
                title={isDisabled ? 'RSVP unavailable' : actionLabel}
            >
                <Bookmark
                    fill={isSaved ? 'white' : 'none'}
                    className={`transition-all ${isDisabled ? 'text-slate-400' : 'text-white'}`}
                    size={showLabel ? 18 : 24}
                    aria-hidden="true"
                />
                {showLabel && <span className="text-white">{loadError ? 'Retry RSVP' : isPastEvent ? (isSaved ? 'Attended' : 'Mark attended') : (isSaved ? 'RSVPed' : 'RSVP')}</span>}
            </button>
            {attendanceStep && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6"
                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby={`attendance-title-${eventId}`}
                        className="w-full max-w-md rounded-2xl border border-default bg-surface p-6 shadow-2xl">
                        <h3 id={`attendance-title-${eventId}`} className="text-xl font-semibold text-text">
                            {attendanceStep === 'confirm' ? 'Did you attend this event?' : 'Attendance recorded'}
                        </h3>
                        <p className="mt-3 text-sm text-muted">
                            {attendanceStep === 'confirm'
                                ? 'Confirm that you attended. Past attendance does not earn RSVP points.'
                                : 'Leave a review to share your experience and earn review points.'}
                        </p>
                        {attendanceError && <p role="alert" className="mt-3 text-sm text-red-500">{attendanceError}</p>}
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" disabled={isSubmitting} onClick={() => setAttendanceStep(null)}
                                className="rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text disabled:opacity-60">
                                {attendanceStep === 'confirm' ? 'Cancel' : 'Not now'}
                            </button>
                            <button type="button" disabled={isSubmitting}
                                onClick={() => {
                                    if (attendanceStep === 'confirm') void updateSaved(true, true);
                                    else {
                                        setAttendanceStep(null);
                                        if (onReview) onReview();
                                        else window.location.assign(`/events/${eventId}?showReviewModal=true`);
                                    }
                                }}
                                className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
                                {attendanceStep === 'confirm' ? (isSubmitting ? 'Saving...' : 'Yes, I attended') : 'Leave a review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <AuthRequiredModal
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                message="Please log in or sign up to save events."
            />
            {toastMessage && <ActionToast message={toastMessage} />}
        </>
    );
};

export const FollowEntityButton: React.FC<SaveEntityButtonProps> = ({ entity, entityId, initialSaved, isDisabled, onFollowChange, compact = false }) => {
    const { session, loading: authLoading } = useAuth();
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined && !!session);
    const [loadError, setLoadError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showPopup, setShowPopup] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const isSubmittingRef = useRef(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = (message: string) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }

        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
            toastTimerRef.current = null;
        }, 2200);
    };

    useEffect(() => () => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        if (initialSaved !== undefined) {
            setIsSaved(initialSaved);
            setIsLoading(false);
            setLoadError(false);
            return () => {
                isMounted = false;
            };
        }

        if (authLoading) {
            return () => {
                isMounted = false;
            };
        }

        if (!session) {
            setIsSaved(false);
            setIsLoading(false);
            setLoadError(false);
            return () => {
                isMounted = false;
            };
        }

        if (entity === 'users' && String(entityId) === session.user.id) {
            setIsLoading(false);
            return () => { isMounted = false; };
        }

        setIsLoading(true);
        fetch(`/api/users/saved-${entity}/${entityId}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to check follow status');
                return res.json();
            })
            .then((data) => {
                if (typeof data.isSaved !== 'boolean') throw new Error('Invalid follow status response');
                if (isMounted) {
                    setIsSaved(data.isSaved);
                    setIsLoading(false);
                    setLoadError(false);
                }
            })
            .catch((error) => {
                console.error('Error fetching saved state:', error);
                if (isMounted) {
                    setIsLoading(false);
                    setLoadError(true);
                    showToast('Could not load follow status');
                }
            });

        return () => {
            isMounted = false;
        };
    }, [entityId, entity, initialSaved, session, authLoading, retryCount]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isDisabled) {
            return;
        }

        if (!session) {
            setShowPopup(true);
            return;
        }

        if (loadError) {
            setIsLoading(true);
            setRetryCount((count) => count + 1);
            return;
        }
        
        // Prevent multiple simultaneous requests
        if (isSubmittingRef.current) return;
        
        isSubmittingRef.current = true;
        const previousSavedState = isSaved;
        const newSavedState = !isSaved;
        setIsSaved(newSavedState);
        try {
            const response = await fetch(`/api/users/saved-${entity}/${entityId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: newSavedState })
            });

            if (!response.ok) {
                throw new Error('Failed to update follow state');
            }

            onFollowChange?.(newSavedState);
            showToast(
                newSavedState
                    ? `Now following this ${getFollowedEntityLabel(entity)}`
                    : `Unfollowed this ${getFollowedEntityLabel(entity)}`
            );
        } catch (error) {
            console.error('Failed to follow/unfollow user:', error);
            setIsSaved(previousSavedState);
            showToast('Could not update follow status. Please try again.');
        } finally {
            isSubmittingRef.current = false;
        }
    };

    if (entity === 'users' && session?.user.id === String(entityId)) return null;

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                disabled={isLoading || authLoading || isDisabled}
                className={`group ${compact ? 'px-3 py-1 text-sm' : 'px-6 py-2'} rounded transition ${!isSaved ? 'btn-highlighted' : ''} ${isDisabled ? 'cursor-not-allowed opacity-40 grayscale' : 'hover:opacity-90'}`}
                aria-disabled={isLoading || authLoading || isDisabled}
                aria-pressed={loadError ? undefined : isSaved}
                title={isDisabled ? 'Follow is unavailable' : loadError ? 'Retry loading follow status' : isSaved ? 'Unfollow' : 'Follow'}
            >
                {loadError ? 'Retry' : isSaved ? 'Unfollow' : 'Follow'}
            </button>
            <AuthRequiredModal
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                message={`Please log in or sign up to follow ${entity}.`}
            />
            {toastMessage && <ActionToast message={toastMessage} />}
        </>
    );
};
