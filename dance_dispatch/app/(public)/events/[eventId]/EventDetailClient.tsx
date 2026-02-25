'use client';
import { useState } from 'react';
import Image from 'next/image';
import { MapPin, Calendar, Users, Share2 } from 'lucide-react';
import { Event, EventReview } from '@/lib/utils';
import { DisplayEventReview, ReviewModal } from '@/app/components/EventReview';
import { SaveEventButton } from '@/app/components/SaveEventButton';
import { RelatedEventCard } from '@/app/components/EventCard';

interface EventDetailClientProps {
    event: Event;
    eventReviews: EventReview[];
    relatedEvents: Event[];
}

export function EventDetailClient({ event, eventReviews, relatedEvents }: EventDetailClientProps) {
    const [isRsvped, setIsRsvped] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Flyer Section */}
            <div className="relative w-full h-96 bg-gray-200 group">
                <Image
                    src={event.imageurl ? event.imageurl : '/images/default_event.jpg'}
                    alt={event.title}
                    fill
                    className="object-cover"
                    loading="eager"
                    priority
                />
                <button
                    className="absolute top-4 left-4 bg-black bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10"
                    onClick={async () => {
                        const url = prompt('Enter image URL:');
                        if (url && event?.id) {
                            const response = await fetch(`/api/events/${event.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ PhotoURL: url })
                            });
                            if (response.ok) {
                                window.location.reload();
                            }
                        }
                    }}
                >
                    📸 Upload
                </button>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2">
                        {/* Title & Actions */}
                        <div className="mb-6">
                            <h1 className="text-4xl font-bold mb-4 text-gray-900">{event.title}</h1>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsRsvped(!isRsvped)}
                                    className={`px-6 py-2 rounded-lg font-semibold transition ${
                                        isRsvped
                                            ? 'bg-green-600 text-white'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                    {isRsvped ? '✓ RSVP\'d' : 'RSVP'}
                                </button>
                                <SaveEventButton entity='events' entityId={event.id} />
                                <button className="p-2 border rounded-lg hover:bg-gray-100">
                                    <Share2 className="text-gray-600" />
                                </button>
                            </div>
                        </div>

                        {/* Event Details */}
                        <div className="bg-white rounded-lg p-6 mb-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-gray-600">Start</p>
                                    <p className="font-semibold text-gray-700">{event.startdate} • {event.starttime}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-gray-600">End</p>
                                    <p className="font-semibold text-gray-700">{event.enddate} • {event.endtime}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-gray-600">Location</p>
                                    <p className="font-semibold text-gray-700">{event.location}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Users className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-gray-600">Attendees</p>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {event.description && (
                            <div className="bg-white rounded-lg p-6 mb-6">
                                <h2 className="text-2xl font-bold mb-4 text-gray-700">About</h2>
                                <p className="text-gray-700">{event.description}</p>
                            </div>
                        )}

                        {/* Venue */}
                        <div className="bg-white rounded-lg p-6 mb-6">
                            <h2 className="text-2xl text-gray-700 font-bold mb-4">Venue Information</h2>
                            <a href={`/venues/${event.locationid}`} className="block border rounded-lg p-4 hover:shadow-md transition">
                                <h3 className="font-semibold text-gray-700 text-lg mb-2">{event.location}</h3>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <MapPin size={18} />
                                    <p className="text-sm">{event.location}</p>
                                </div>
                            </a>
                        </div>

                        {/* Reviews Section */}
                        <div className="bg-white rounded-lg p-6">
                            <h2 className="text-2xl font-bold mb-4 text-gray-700">Reviews</h2>
                            <div className="space-y-4">
                                {
                                    eventReviews.length === 0 ? <p className="text-gray-600">No reviews yet. Be the first to review!</p> :
                                        eventReviews.map((review, index) => (
                                            <DisplayEventReview key={index} review={review} />
                                        ))
                                }
                            </div>
                            <button
                                onClick={() => setShowReviewModal(true)}
                                className="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50 font-semibold text-gray-700"
                            >
                                Write a Review
                            </button>
                            {showReviewModal &&
                                <ReviewModal
                                    isOpen={showReviewModal}
                                    event={event}
                                    onClose={() => setShowReviewModal(false)}
                                    onSubmit={async (reviews) => {
                                        if (!event?.id) return;
                                        const response = await fetch(`/api/reviews/${event.id}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: reviews })
                                        });
                                        if (response.ok) {
                                            window.location.reload();
                                        }
                                        setShowReviewModal(false);
                                    }}
                                />
                            }
                        </div>
                    </div>

                    {/* Right Column - Related Events */}
                    <div>
                        <div className="bg-white rounded-lg p-6 sticky top-8">
                            <h2 className="text-2xl text-gray-700 font-bold mb-4">Related Events</h2>
                            <div className="space-y-4">
                                {relatedEvents.map((relEvent) => (
                                    <RelatedEventCard key={relEvent.id} event={relEvent} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
