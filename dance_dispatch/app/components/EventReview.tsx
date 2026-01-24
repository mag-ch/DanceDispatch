import { useState } from "react";
import { Event, EventReview } from '@/lib/utils';
import { Rat, Star, X } from "lucide-react";
import React from "react";

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
    privacyLevel: 'public' | 'private' | 'anonymous';
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">Rating</label>
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">Comments</label>
            <textarea
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Share your thoughts..."
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={1}
            />
            </div>
            </div>
    )
}


export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, event, onClose, onSubmit }) => {
    const [generalComment, setGeneralComment] = useState('');
    
    // Venue review state
    const [venueRating, setVenueRating] = useState(0);
    const [venueComment, setVenueComment] = useState('');
    
    // DJ reviews state - map of dj name to {rating, comment}
    const [djReviews, setDjReviews] = useState<Record<string, { rating: number; comment: string }>>({});

    const [showVenueSection, setShowVenueSection] = useState(false);
    const [showDJSection, setShowDJSection] = useState(false);
    const [privacyLevel, setPrivacyLevel] = useState<'public' | 'private' | 'anonymous'>('public');

    // Initialize djReviews when event.hosts changes
    React.useEffect(() => {
        if (event.hosts) {
            const initialDjReviews: Record<string, { rating: number; comment: string }> = {};
            event.hosts.forEach(dj => {
                if (!djReviews[dj]) {
                    initialDjReviews[dj] = { rating: 0, comment: '' };
                }
            });
            if (Object.keys(initialDjReviews).length > 0) {
                setDjReviews(prev => ({ ...prev, ...initialDjReviews }));
            }
        }
    }, [event.hosts]);

    const handleDjRatingChange = (dj: string, rating: number) => {
        setDjReviews(prev => ({
            ...prev,
            [dj]: { ...prev[dj], rating }
        }));
    };

    const handleDjCommentChange = (dj: string, comment: string) => {
        setDjReviews(prev => ({
            ...prev,
            [dj]: { ...prev[dj], comment }
        }));
    };

    const handleSubmit = () => {
        const reviewsToSubmit: ReviewData[] = [];

        // Add general comment if provided
        if (generalComment.trim()) {
            reviewsToSubmit.push({
                entityType: 'event',
                entityId: event.id || '',
                rating: 0,
                comment: generalComment,
                privacyLevel: privacyLevel
            });
        }

        // Add venue review if it has a rating
        if (venueRating > 0) {
            reviewsToSubmit.push({
                entityType: 'venue',
                entityId: event.locationid || '',
                rating: venueRating,
                comment: venueComment,
                privacyLevel: privacyLevel
            });
        }

        // Add DJ reviews if they have a rating
        Object.entries(djReviews).forEach(([dj, review]) => {
            if (review.rating > 0) {
                reviewsToSubmit.push({
                    entityType: 'dj',
                    entityId: dj,
                    rating: review.rating,
                    comment: review.comment,
                    privacyLevel: privacyLevel
                });
            }
        });

        onSubmit(reviewsToSubmit);
        
        // Reset state
        setGeneralComment('');
        setVenueRating(0);
        setVenueComment('');
        setDjReviews({});
        setPrivacyLevel('public');
        onClose();
    };

    if (!isOpen) return null;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[70vh] flex flex-col shadow-lg">
                {/* Header */}
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-900">Leave a Review</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                    <X size={24} />
                    </button>
                </div>
                {/* Sub header */}
                <div className="mb-4 flex-shrink-0">
                    <p className="text-xs font-medium text-gray-800">{event.title}</p>
                </div>
                {/* Privacy Level Selection */}
                <div className="mb-2 pb-4 border-b">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Privacy Level</label>
                    <div className="flex gap-4">
                    {(['public', 'private', 'anonymous'] as const).map((level) => (
                        <label key={level} className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="privacy"
                            value={level}
                            checked={privacyLevel === level}
                            onChange={(e) => setPrivacyLevel(e.target.value as typeof level)}
                            className="w-4 h-4"
                        />
                        <span className="text-gray-700 capitalize">{level}</span>
                        </label>
                    ))}
                    </div>
                </div>
                {/* Scrollable portion */}
                <div className="overflow-y-auto flex-1 pr-2">

                    {/* Section 1: Comment */}
                    <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Comments</label>
                    <textarea
                        value={generalComment}
                        onChange={(e) => setGeneralComment(e.target.value)}
                        placeholder="Share your thoughts..."
                        className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={3}
                    />
                    </div>
                    
                    {/* Section 2: Venue Toggle */}
                    <div className="mb-3 sticky top-0 bg-white z-10 py-2">
                        <button
                            onClick={() => setShowVenueSection(!showVenueSection)}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-600 focus:outline-none"
                        >
                            <span className={`transition-transform ${showVenueSection ? 'rotate-90' : ''}`}>▶</span>
                            Venue: {event.location}
                        </button>
                    </div>
                    
                    {/* Section 3: Venue Review */}
                    {showVenueSection && (
                        <RatingCommentCombo 
                            rating={venueRating}
                            comment={venueComment}
                            onRatingChange={setVenueRating}
                            onCommentChange={setVenueComment}
                        />
                    )}

                     {/* Section 4: DJ Toggle */}
                    <div className="mb-3 sticky top-0 bg-white z-10 py-2">
                        <button
                            onClick={() => setShowDJSection(!showDJSection)}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-600 focus:outline-none"
                        >
                            <span className={`transition-transform ${showDJSection ? 'rotate-90' : ''}`}>▶</span>
                            DJs: {event.hosts?.join(", ")}
                        </button>
                    </div>
                    {/* Section 5: DJ Reviews */}
                    {showDJSection && (
                        event.hosts?.map((dj) => (
                            <div key={dj} className="mb-6">
                                <h3 className="text-md font-semibold text-gray-900 mb-2">{dj}</h3>
                                <RatingCommentCombo 
                                    rating={djReviews[dj]?.rating || 0}
                                    comment={djReviews[dj]?.comment || ''}
                                    onRatingChange={(rating) => handleDjRatingChange(dj, rating)}
                                    onCommentChange={(comment) => handleDjCommentChange(dj, comment)}
                                />
                            </div>
                        ))
                    )}

                </div>
                    {/* Submit Button */}
                    <div className="mt-6 flex gap-3 flex-shrink-0 border-t pt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                            Submit Review
                        </button>
                    </div>
            </div>
        </div>
    );
};

export const DisplayEventReview: React.FC<{ review: EventReview }> = ({ review }) => {
    return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
        {/* Header: username, date, privacy */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{review.username}</span>
                <span className="text-sm text-gray-500">•</span>
                <span className="text-sm text-gray-500">{new Date(review.dateSubmitted).toLocaleDateString()}</span>
            </div>
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full capitalize">
                {review.privacyLevel}
            </span>
        </div>

        {/* Content sections in horizontal row */}
        <div className="flex gap-6 overflow-x-auto pb-4">
            {/* Main Comment Section */}
            {review.mainComment && (
                <div className="flex-shrink-0 min-w-[200px] max-w-[250px]">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">General Comment</h4>
                    <p className="text-sm text-gray-700">{review.mainComment}</p>
                </div>
            )}

            {/* Venue Review Section */}
            {review.venueReview && (
                <div className="flex-shrink-0 min-w-[200px] max-w-[250px]">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Venue</h4>
                    <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                size={16}
                                className={star <= (review.venueReview?.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                            />
                        ))}
                    </div>
                    {review.venueReview.comments && (
                        <p className="text-sm text-gray-700">{review.venueReview.comments}</p>
                    )}
                </div>
            )}

            {/* DJ Reviews Section */}
            {review.djReviews && review.djReviews.map((djReview) => (
                <div key={djReview.djId} className="flex-shrink-0 min-w-[200px] max-w-[250px]">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{djReview.djId}</h4>
                    <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                size={16}
                                className={star <= djReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                            />
                        ))}
                    </div>
                    {djReview.comments && (
                        <p className="text-sm text-gray-700">{djReview.comments}</p>
                    )}
                </div>
            ))}
        </div>
    </div>
    );
}