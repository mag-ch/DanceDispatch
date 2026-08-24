'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { AuthRequiredModal } from '@/app/components/AuthRequiredModal';

interface SaveEventButtonProps {
    entity: string;
    entityId: string | number;
    initialSaved?: boolean;
    isDisabled?: boolean;
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

export const SaveEventButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved, isDisabled }) => {
    const { session, loading: authLoading } = useAuth();
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined && !!session);
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
            return () => {
                isMounted = false;
            };
        }

        setIsLoading(true);
        fetch(`/api/users/saved-${entity}/${entityId}`)
            .then((res) => res.json())
            .then((data) => {
                if (isMounted) {
                    setIsSaved(!!data.isSaved);
                    setIsLoading(false);
                }
            })
            .catch((error) => {
                console.error('Error fetching saved state:', error);
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [entityId, entity, initialSaved, session, authLoading]);

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
        
        // Prevent multiple simultaneous requests
        if (isSubmittingRef.current) return;
        
        isSubmittingRef.current = true;
        const newSavedState = !isSaved;
        try {
            const response = await fetch(`/api/users/saved-${entity}/${entityId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: newSavedState })
            });

            if (!response.ok) {
                throw new Error('Failed to update saved state');
            }

            setIsSaved(newSavedState);
            if (newSavedState) {
                showToast("RSVP'ed to event");
            }
            else {
                showToast('Removed from RSVPs');
            }
        } catch (error) {
            console.error('Failed to save event:', error);
        } finally {
            isSubmittingRef.current = false;
        }
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isLoading || isDisabled}
                className={`group rounded-full p-2 transition ${isDisabled ? 'cursor-not-allowed opacity-40 grayscale' : 'hover:opacity-80'}`}
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                aria-disabled={isLoading || isDisabled}
                title={isDisabled ? 'RSVP closed for past events' : 'Save event'}
            >
                <Bookmark
                    fill={isSaved ? 'white' : 'none'}
                    className={`transition-all ${isDisabled ? 'text-slate-400' : 'text-white'}`}
                />
            </button>
            <AuthRequiredModal
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                message="Please log in or sign up to save events."
            />
            {toastMessage && <ActionToast message={toastMessage} />}
        </>
    );
};

export const FollowEntityButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved, isDisabled }) => {
    const { session, loading: authLoading } = useAuth();
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined && !!session);
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
            return () => {
                isMounted = false;
            };
        }

        setIsLoading(true);
        fetch(`/api/users/saved-${entity}/${entityId}`)
            .then((res) => res.json())
            .then((data) => {
                if (isMounted) {
                    setIsSaved(!!data.isSaved);
                    setIsLoading(false);
                }
            })
            .catch((error) => {
                console.error('Error fetching saved state:', error);
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [entityId, entity, initialSaved, session, authLoading]);

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
        
        // Prevent multiple simultaneous requests
        if (isSubmittingRef.current) return;
        
        isSubmittingRef.current = true;
        const newSavedState = !isSaved;
        try {
            const response = await fetch(`/api/users/saved-${entity}/${entityId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: newSavedState })
            });

            if (!response.ok) {
                throw new Error('Failed to update follow state');
            }

            setIsSaved(newSavedState);
            showToast(
                newSavedState
                    ? `Now following this ${getFollowedEntityLabel(entity)}`
                    : `Unfollowed this ${getFollowedEntityLabel(entity)}`
            );
        } catch (error) {
            console.error('Failed to follow/unfollow user:', error);
        } finally {
            isSubmittingRef.current = false;
        }
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isLoading || isDisabled}
                className={`group px-6 py-2 rounded transition ${!isSaved ? 'btn-highlighted' : ''} ${isDisabled ? 'cursor-not-allowed opacity-40 grayscale' : 'hover:opacity-90'}`}
                aria-disabled={isLoading || isDisabled}
                title={isDisabled ? 'Follow is unavailable for past items' : 'Follow'}
            >
                {isSaved ? 'Unfollow' : 'Follow'}
            </button>
            <AuthRequiredModal
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                message="Please log in or sign up to follow users."
            />
            {toastMessage && <ActionToast message={toastMessage} />}
        </>
    );
};
