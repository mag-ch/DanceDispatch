'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Heart } from 'lucide-react';

interface SaveEventButtonProps {
    entity: string;
    entityId: string | number;
    initialSaved?: boolean;
}

export const SaveEventButton: React.FC<SaveEventButtonProps> = ({ entity, entityId, initialSaved }) => {
    const [isSaved, setIsSaved] = useState(initialSaved ?? false);
    const [isLoading, setIsLoading] = useState(initialSaved === undefined);
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        // Only fetch if initialSaved was not provided
        if (initialSaved === undefined) {
            let isMounted = true;
            fetch(`/api/users/saved-${entity}/${entityId}`)
                .then(res => res.json())
                .then(data => {
                    if (isMounted) {
                        setIsSaved(data.isSaved);
                        setIsLoading(false);
                    }
                })
                .catch(error => {
                    console.error('Error fetching saved state:', error);
                    if (isMounted) setIsLoading(false);
                });
            return () => { isMounted = false; };
        }
    }, [entityId, entity, initialSaved]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
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
    );
};
