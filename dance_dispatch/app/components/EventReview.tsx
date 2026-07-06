'use client';
import { useEffect, useState } from "react";
import { Event, EventReview } from '@/lib/utils';
import { Rat, Star, X, Trash2, Globe, Lock, UserX  } from "lucide-react";
import React from "react";
import EventMediaUpload, { MediaFile } from "./EventMediaUpload";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "../providers/AuthContext";
import Link from 'next/link';

interface ReviewModalProps {
    isOpen: boolean;
    event: Event;
    onClose: () => void;
    onSubmit: (reviews: ReviewData[]) => void;
    
}

interface ReviewData {
    entityType: string;
    entityId: string;
    rating: number;
    comment: string;
    privacyLevel: 'public' | 'private' | 'anonymous'
    mediaPaths?: string[];
}

interface RatingCommentComboProps {
    rating: number;
    comment: string;
    onRatingChange: (rating: number) => void;
    onCommentChange: (comment: string) => void;
}

export const RatingCommentCombo: React.FC<RatingCommentComboProps> = ({ 
    rating, 
    comment, 
    onRatingChange, 
    onCommentChange 
}) => {
    const [hoverRating, setHoverRating] = useState(0);
    return (
        <div>
            {/* Star rating */}

            <div className="mb-4">
            <label className="block text-sm font-semibold text-text mb-2">Rating</label>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => onRatingChange(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                >
                    <Star
                    size={25}
                    className={
                        star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }
                    />
                </button>
                ))}
            </div>
            </div>
            {/* Comment box */}
            <div className="mb-6">
            <label className="block text-sm font-semibold text-text mb-2">Comments</label>
            <textarea
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full border border-gray-300 rounded-lg p-3 text-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={1}
            />
            </div>
            </div>
    )
}

// Updated ReviewModal with media upload inline
export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, event, onClose, onSubmit }) => {
    const [generalComment, setGeneralComment] = useState('');
    const [venueRating, setVenueRating] = useState(0);
    const [venueComment, setVenueComment] = useState('');
    const [djReviews, setDjReviews] = useState<Record<string, { rating: number; comment: string }>>({});
    const [showVenueSection, setShowVenueSection] = useState(false);
    const [showDJSection, setShowDJSection] = useState(false);
    const [privacyLevel, setPrivacyLevel] = useState<'public' | 'private' | 'anonymous'>('public');
    const [userMedia, setUserMedia] = useState<MediaFile[]>([]);

    React.useEffect(() => {
        if (event.hostNames) {
            const initialDjReviews: Record<string, { rating: number; comment: string }> = {};
            event.hostNames.forEach(dj => {
                if (!djReviews[dj]) initialDjReviews[dj] = { rating: 0, comment: '' };
            });
            if (Object.keys(initialDjReviews).length > 0) {
                setDjReviews(prev => ({ ...prev, ...initialDjReviews }));
            }
        }
    }, [event.hostNames]);

    const handleDjRatingChange = (dj: string, rating: number) => {
        setDjReviews(prev => ({ ...prev, [dj]: { ...prev[dj], rating } }));
    };
    const handleDjCommentChange = (dj: string, comment: string) => {
        setDjReviews(prev => ({ ...prev, [dj]: { ...prev[dj], comment } }));
    };

    const handleSubmit = () => {
        const reviewsToSubmit: ReviewData[] = [];

        if (generalComment.trim()) {
            reviewsToSubmit.push({
                entityType: 'event',
                entityId: event.id || '',
                rating: 0,
                comment: generalComment,
                privacyLevel,
                // Pass media paths so your backend can store the association
                mediaPaths: userMedia.map(m => m.path),
            });
        }
        if (venueRating > 0 || venueComment.length>0) {
            reviewsToSubmit.push({
                entityType: 'venue',
                entityId: event.locationid || '',
                rating: venueRating,
                comment: venueComment,
                privacyLevel,
            });
        }
        Object.entries(djReviews).forEach(([dj, review]) => {
            if (review.rating > 0|| review.comment.length>0) {
                reviewsToSubmit.push({
                    entityType: 'host',
                    entityId: dj,
                    rating: review.rating,
                    comment: review.comment,
                    privacyLevel,
                });
            }
        });

        onSubmit(reviewsToSubmit);
        setGeneralComment('');
        setVenueRating(0);
        setVenueComment('');
        setDjReviews({});
        setPrivacyLevel('public');
        onClose();
        setUserMedia([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-lg p-6 w-full max-w-[75vw] max-h-[75vh] flex flex-col shadow-lg">
                {/* Header */}
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-text">Leave a Review</h2>
                    <button onClick={onClose} className="text-text hover:text-text"><X size={24} /></button>
                </div>
                <div className="mb-4 flex-shrink-0">
                    <p className="text-xs font-medium text-text">{event.title}</p>
                </div>

                {/* Privacy */}
                <div className="mb-2 pb-4 border-b flex-shrink-0">
                    <label className="block text-sm font-semibold text-text mb-3">Privacy Level</label>
                    <div className="flex gap-4">
                        {(['public', 'private', 'anonymous'] as const).map((level) => (
                            <label key={level} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="privacy" value={level} checked={privacyLevel === level} onChange={() => setPrivacyLevel(level)} className="w-4 h-4" />
                                <span className="text-text capitalize">{level}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1 pr-2">

                    {/* General comment */}
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-text mb-2">Comments</label>
                        <textarea
                            value={generalComment}
                            onChange={(e) => setGeneralComment(e.target.value)}
                            placeholder="Share your thoughts..."
                            className="w-full border border-gray-300 rounded-lg p-3 text-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            rows={3}
                        />
                    </div>

                    {/* ── Media upload ── */}
                    <div className="mb-5">
                        <label className="block text-sm font-semibold text-text mb-2">
                            Photos & Videos
                            <span className="text-muted font-normal ml-1">(optional · up to 3)</span>
                        </label>
                        <EventMediaUpload
                            eventId={event.id || ''}
                            mode="inline"
                            onMediaChange={setUserMedia}
                            hosts = {event.hostNames}
                        />
                    </div>

                    {/* Venue toggle */}
                    <div className="mb-3 sticky top-0 bg-surface z-10 py-2">
                        <button onClick={() => setShowVenueSection(!showVenueSection)} className="flex items-center gap-2 text-sm font-semibold text-text hover:text-blue-600 focus:outline-none">
                            <span className={`transition-transform ${showVenueSection ? 'rotate-90' : ''}`}>▶</span>
                            Venue: {event.location}
                        </button>
                    </div>
                    {showVenueSection && (
                        <RatingCommentCombo rating={venueRating} comment={venueComment} onRatingChange={setVenueRating} onCommentChange={setVenueComment} />
                    )}

                    {/* DJ toggle */}
                    <div className="mb-3 sticky top-0 bg-surface z-10 py-2">
                        <button onClick={() => setShowDJSection(!showDJSection)} className="flex items-center gap-2 text-sm font-semibold text-text hover:text-blue-600 focus:outline-none">
                            <span className={`transition-transform ${showDJSection ? 'rotate-90' : ''}`}>▶</span>
                            DJs: {event.hostNames?.join(', ')}
                        </button>
                    </div>
                    {showDJSection && event.hostIDs?.map((dj, index) => (
                        <div key={dj} className="mb-6">
                            <h3 className="text-md font-semibold text-text mb-2">{event.hostNames?.[index] ?? dj}</h3>
                            <RatingCommentCombo
                                rating={djReviews[dj]?.rating || 0}
                                comment={djReviews[dj]?.comment || ''}
                                onRatingChange={(rating) => handleDjRatingChange(dj, rating)}
                                onCommentChange={(comment) => handleDjCommentChange(dj, comment)}
                            />
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-6 flex gap-3 flex-shrink-0 border-t pt-4">
                    <button onClick={onClose} className="flex-1 px-4 py-2 text-text border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} className="btn-highlighted flex-1 px-4 py-2 rounded-lg font-medium">
                        Submit Review
                    </button>
                </div>
            </div>
        </div>
    );
};


export const DisplayEventReview: React.FC<{ review: EventReview; onDeleted?: () => void; compact?: boolean }> = ({ review, onDeleted, compact = false }) => {

    type PrivacyLevel = 'public' | 'private' | 'anonymous';

    const PRIVACY_CONFIG: Record<PrivacyLevel, { label: string; icon: React.ReactNode; next: PrivacyLevel }> = {
        public:    { label: 'Public',    icon: <Globe size={12} />,   next: 'anonymous' },
        anonymous: { label: 'Anonymous', icon: <UserX size={12} />,   next: 'private'   },
        private:   { label: 'Private',   icon: <Lock size={12} />,    next: 'public'    },
    };

    const PRIVACY_COLORS: Record<PrivacyLevel, string> = {
        public:    'bg-green-100 text-green-700 hover:bg-green-200',
        anonymous: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
        private:   'bg-gray-200 text-gray-600 hover:bg-gray-300',
    };

    const { session, loading: authLoading } = useAuth();

    // Don't render owner controls until auth is resolved

    const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(review.privacyLevel as PrivacyLevel);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleted, setDeleted] = useState(false);


    useEffect(() => {
        if (authLoading ) return;
        if (session) {
            setIsOwner(!!session?.user?.id && session.user.id === review.userId);
            console.log(session.user.id);
            console.log(review);
        } else {
            setIsOwner(false);
        }
    }, [authLoading, session, review.userId]);
    
    
    const displayUsername = privacyLevel === 'anonymous' ? 'Anonymous' : review.username;
    const usernameComponent = review.userId && privacyLevel !== 'anonymous'
        ? (
            <Link href={`/users/${review.userId}`} className="font-semibold text-text hover:underline">
                {displayUsername}
            </Link>
          )
        : <span className="font-semibold text-text">{displayUsername}</span>;

    const supabase = createClient();
    
    const handlePrivacyCycle = async () => {
        const next = PRIVACY_CONFIG[privacyLevel].next;
        setIsUpdatingPrivacy(true);
        try {
            const { error } = await supabase
            .from('Reviews')
            .update({ privacy_level: next })
            .eq('event_id', Number(review.eventId))
            .eq('user_id', session?.user?.id);
            if (error) throw error;
            setPrivacyLevel(next);
        } catch (err) {
            console.error('Failed to update privacy:', err);
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };
    
    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setIsDeleting(true);
        try {
            const { error } = await supabase
            .from('Reviews')
            .delete()
            .eq('event_id', Number(review.eventId))
            .eq('user_id', session?.user?.id);
            if (error) throw error;
            setDeleted(true);
            onDeleted?.();
        } catch (err) {
            console.error('Failed to delete review:', err);
            setIsDeleting(false);
            setConfirmDelete(false);
        }
    };
    
    if (deleted) return null;
    
    // Hide entirely if private and not the owner
    if (privacyLevel === 'private' && !isOwner) return null;
    
    const config = PRIVACY_CONFIG[privacyLevel];
    
    // --- Dynamic module layout ---
    // Count how many review "modules" we're rendering (main comment, venue, each DJ).
    const moduleCount =
    (review.mainComment ? 1 : 0) +
    (review.venueReview ? 1 : 0) +
    (review.djReviews?.length ?? 0);
    
    // With a small number of modules, let them split the available width evenly.
    // Once there are enough that an even split would feel cramped, fall back to the
    // fixed-width, horizontally-scrolling layout.
    const DYNAMIC_WIDTH_THRESHOLD = 3;
    const useDynamicWidth = moduleCount > 0 && moduleCount <= DYNAMIC_WIDTH_THRESHOLD;
    
    const containerClassName = 'flex gap-3 overflow-x-auto pb-3';

    
    const moduleClassName = useDynamicWidth
    ? compact
        ? 'flex-1 min-w-[140px]'
        : 'flex-1 min-w-[180px]'
    : compact
        ? 'flex-shrink-0 min-w-[160px] max-w-[210px]'
        : 'flex-shrink-0 min-w-[200px] max-w-[250px]';
    
    return (
        <div className={`bg-surface rounded-lg shadow transition-opacity ${compact ? 'p-3' : 'p-4'} ${isDeleting ? 'opacity-50' : ''}`}>
            {/* Header */}
            <div className={`flex items-center justify-between ${compact ? 'mb-3 pb-2' : 'mb-4 pb-3'} border-b`}>
                <div className="flex items-center gap-2">
                    {usernameComponent}
                    <span className={`text-sm text-text ${compact ? 'opacity-80' : ''}`}>•</span>
                    <span className={`text-sm text-text ${compact ? 'opacity-80' : ''}`}>{new Date(review.dateSubmitted).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Privacy badge — clickable for owner */}
                    {isOwner ? (
                        <button
                            type="button"
                            onClick={handlePrivacyCycle}
                            disabled={isUpdatingPrivacy}
                            title="Click to change privacy"
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full capitalize font-medium transition-colors ${PRIVACY_COLORS[privacyLevel]} ${isUpdatingPrivacy ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {config.icon}
                            {config.label}
                        </button>
                    ) : (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 bg-accent text-text rounded-full capitalize">
                            {config.icon}
                            {config.label}
                        </span>
                    )}

                    {/* Delete button — owner only */}
                    {isOwner && (
                        confirmDelete ? (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="text-xs px-2 py-1 bg-red-500 text-white rounded-full hover:bg-red-600 font-medium"
                                >
                                    {isDeleting ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-xs px-2 py-1 bg-gray-200 text-text rounded-full hover:bg-gray-300 font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleDelete}
                                title="Delete review"
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                            >
                                <Trash2 size={15} />
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Review content */}
            <div className={containerClassName}>
                {review.mainComment && (
                    <div className={moduleClassName}>
                        <Link
                            href={`/events/${review.eventId}`}
                            className="block truncate text-sm font-semibold text-text mb-2 hover:underline"
                            title={review.eventName}
                        >
                            {review.eventName}
                        </Link>
                        <p className="text-sm text-text">{review.mainComment}</p>
                    </div>
                )}
                {review.venueReview && (
                    <div className={moduleClassName}>
                        <h4 className="text-sm font-semibold text-text mb-2 truncate">{review.venueReview.venueName}</h4>
                        {review.venueReview.rating > 0 && (
                        <div className="flex gap-1 mb-2">
                            {[1,2,3,4,5].map((star) => (
                                <Star key={star} size={16} className={star <= (review.venueReview?.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                            ))}
                        </div>
                        )}
                        {review.venueReview.comments && <p className="text-sm text-text">{review.venueReview.comments}</p>}
                    </div>
                )}
                {review.djReviews?.map((djReview) => (
                    <div key={djReview.djName} className={moduleClassName}>
                        <h4 className="text-sm font-semibold text-text mb-2 truncate">{djReview.djName}</h4>
                        {djReview.rating > 0 && (
                            <div className="flex gap-1 mb-2">
                            {[1,2,3,4,5].map((star) => (
                                <Star key={star} size={16} className={star <= djReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                            ))}
                        </div>
                        )}

                        {djReview.comments && <p className="text-sm text-text">{djReview.comments}</p>}
                    </div>
                ))}
            </div>

            {review.mediaPaths && review.mediaPaths.length > 0 && (
                <div className="mt border-t">
                    {/*
                        EventMediaUpload's own preview sizing is correct on other pages, so rather than
                        change the shared component, we cap it locally here. Note: the <img>/<video> tags
                        inside are always w-full/h-full — their visible size is actually driven by the
                        grid tile (the ".aspect-square" wrapper div), so that's what we need to cap.
                    */}
                    <div className="[&_.aspect-square]:!max-w-[80px] [&_.aspect-square]:!max-h-[80px]">
                        <EventMediaUpload
                            eventId={review.eventId}
                            mode="inline"
                            mediaFiles={review.mediaPaths.map((path) => {
                                const { data } = supabase.storage.from('event-media').getPublicUrl(path);
                                const isVideo = /\.(mp4|mov|webm)$/i.test(path);
                                return {
                                    url: data.publicUrl,
                                    type: isVideo ? 'video' : 'image',
                                    name: path.split('/').pop() ?? path,
                                    path,
                                } satisfies MediaFile;
                            })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};


// ── Standalone full-event gallery (use this on the event page below the reviews) ──
export const EventMediaGallery: React.FC<{ eventId: string }> = ({ eventId}) => {
    return (
        <EventMediaUpload
            eventId={eventId}
            mode="standalone"
        />
    );
};