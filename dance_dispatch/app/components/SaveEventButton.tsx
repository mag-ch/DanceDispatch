'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';

interface SaveEventButtonProps {
    entity: string;
    entityId: string | number;
    initialSaved?: boolean;
}

export const SaveEventButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved }) => {
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
                disabled={isLoading}
                className="disabled:opacity-50 group"
            >
                <Heart
                    fill={isSaved ? 'currentColor' : 'none'}
                    className="text-red-500 group-hover:fill-current group-hover:opacity-50 transition-all"
                />
            </button>
            {showPopup && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="bg-white dark:bg-surface rounded-lg p-6 shadow-lg flex flex-col items-center">
                        <p className="mb-4 text-center text-text">Please log in or sign up to save events.</p>
                        <button
                            onClick={() => {
                                window.location.href = '/auth/login';
                            }}
                            className="btn-highlighted bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mb-2"
                        >
                            Go to Login
                        </button>
                        <button
                            onClick={() => setShowPopup(false)}
                            className="text-muted hover:underline"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export const FollowEntityButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved }) => {
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
                disabled={isLoading}
                className={`disabled:opacity-50 group px-6 py-2 rounded ${!isSaved ? 'btn-highlighted' : ''}`}
            >
                {isSaved ? 'Unfollow' : 'Follow'}
            </button>
            {showPopup && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="bg-white dark:bg-surface rounded-lg p-6 shadow-lg flex flex-col items-center">
                        <p className="mb-4 text-center text-text">Please log in or sign up to save events.</p>
                        <button
                            onClick={() => {
                                window.location.href = '/auth/login';
                            }}
                            className="btn-highlighted bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mb-2"
                        >
                            Go to Login
                        </button>
                        <button
                            onClick={() => setShowPopup(false)}
                            className="text-muted hover:underline"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
