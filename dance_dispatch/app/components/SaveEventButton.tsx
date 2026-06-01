'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { AuthRequiredModal } from '@/app/components/AuthRequiredModal';

interface SaveEventButtonProps {
    entity: string;
    entityId: string | number;
    initialSaved?: boolean;
    isDisabled?: boolean;
}

export const SaveEventButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved, isDisabled }) => {
    const { session, loading: authLoading } = useAuth();
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined && !!session);
    const [showPopup, setShowPopup] = useState(false);
    const isSubmittingRef = useRef(false);

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
            await fetch(`/api/users/saved-${entity}/${entityId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: newSavedState })
            });
            setIsSaved(newSavedState);
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
                className={`group rounded-full transition ${isDisabled ? 'cursor-not-allowed opacity-40 grayscale' : 'hover:opacity-80'}`}
                aria-disabled={isLoading || isDisabled}
                title={isDisabled ? 'RSVP closed for past events' : 'Save event'}
            >
                <Heart
                    fill={isSaved ? 'currentColor' : 'none'}
                    className={`transition-all ${isDisabled ? 'text-slate-400' : 'text-red-500 group-hover:fill-current group-hover:opacity-50'}`}
                />
            </button>
            <AuthRequiredModal
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                message="Please log in or sign up to save events."
            />
        </>
    );
};

export const FollowEntityButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved, isDisabled }) => {
    const { session, loading: authLoading } = useAuth();
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined && !!session);
    const [showPopup, setShowPopup] = useState(false);
    const isSubmittingRef = useRef(false);

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
            await fetch(`/api/users/saved-${entity}/${entityId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: newSavedState })
            });
            setIsSaved(newSavedState);
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
        </>
    );
};
