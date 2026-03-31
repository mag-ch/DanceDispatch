'use client';
import { useState } from 'react';
import Image from 'next/image';
import { MapPin, Calendar, Share2, X } from 'lucide-react';
import { Event, EventReview } from '@/lib/utils';
import { DisplayEventReview, ReviewModal } from '@/app/components/EventReview';
import { SaveEventButton } from '@/app/components/SaveEventButton';
import { RelatedEventCard } from '@/app/components/EventCard';
import { ShareModal } from '@/app/components/ShareModal';

interface EventDetailClientProps {
    event: Event;
    eventReviews: EventReview[];
    relatedEvents: Event[];
    venueAddress: string;
    showReviewModal?: boolean;
}

export function EventDetailClient({ event, eventReviews, relatedEvents, venueAddress, showReviewModal = false }: EventDetailClientProps) {
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(showReviewModal);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);

    const eventImageSrc = event.imageurl ? event.imageurl : '/images/default_event.jpg';

    const formatEventDate = (dateStr?: string) => {
        if (!dateStr) return 'Date TBD';

        const normalized = dateStr.trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            // Use local noon to avoid DST/UTC boundary shifts.
            return new Date(year, month, day, 12, 0, 0).toDateString();
        }

        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? normalized : parsed.toDateString();
    };

    const eventStartAt = event.startdate && event.starttime
        ? `${event.startdate}T${event.starttime}`
        : event.startdate ?? null;

    return (
        <div className="min-h-screen bg-bg">
            {/* Flyer Section */}
            <div className="relative w-full h-96 bg-bg group">
                <button
                    type="button"
                    className="absolute inset-0 block cursor-zoom-in"
                    onClick={() => setShowImageModal(true)}
                    aria-label={`Open full image for ${event.title}`}
                >
                    <Image
                        src={eventImageSrc}
                        alt={event.title}
                        fill
                        className="object-cover"
                        loading="eager"
                        priority
                    />
                </button>
                <button
                    className="absolute top-4 left-4 bg-black bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10"
                    onClick={async () => {
                        const url = prompt('Enter image URL:');
                        if (url && event?.id) {
                            const response = await fetch(`/api/events/${event.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageurl: url })
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

            {showImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6"
                    onClick={() => setShowImageModal(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${event.title} image preview`}
                >
                    <div
                        className="relative flex h-full max-h-[90vh] w-full max-w-6xl items-center justify-center"
                        onClick={(modalEvent) => modalEvent.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="absolute right-0 top-0 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                            onClick={() => setShowImageModal(false)}
                            aria-label="Close image preview"
                        >
                            <X size={20} />
                        </button>
                        <div className="relative h-full max-h-[85vh] w-full overflow-hidden rounded-2xl">
                            <Image
                                src={eventImageSrc}
                                alt={event.title}
                                fill
                                className="object-contain"
                                sizes="100vw"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2">
                        {/* Title & Actions */}
                        <div className="mb-6">
                            <h1 className="text-4xl font-bold mb-4 text-text">{event.title}</h1>
                            <div className="flex gap-4">
                                <SaveEventButton entity='events' entityId={event.id} />
                                <button className="p-2 hover:bg-accent" onClick={() => setShowShareModal(true)} type="button">
                                    <Share2 className="text-gray-600"/>
                                </button>
                                {(event.externallink && event.externallink.length > 3) && <a
                                    href={event.externallink || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className=" btn-highlighted px-6 py-2 rounded-lg font-semibold transition"
                                >
                                    {event.price != undefined ? (event.price == 0 ? 'Free RSVP' : `Buy Tickets - From $${event.price}`) : 'Buy Tickets'}
                                </a>}
                                {(!event.externallink || event.externallink.length <= 3) && event.price != undefined && <span className="px-2 py-2 rounded-lg font-semibold text-muted">
                                    {event.price != undefined ? (event.price == 0 ? 'Free Event' : `$${event.price}`) : 'Price TBD'}
                                </span>}
                            </div>
                        </div>

                        {/* Event Details */}
                        <div className="bg-surface rounded-lg p-6 mb-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-muted">Date</p>
                                    <p className="font-semibold text-text">{formatEventDate(event.startdate)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-muted">Time</p>
                                    <p className="font-semibold text-text">{new Date(`2000-01-01 ${event.starttime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} to {new Date(`2000-01-01 ${event.endtime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-muted">Location</p>
                                    <p className="font-semibold text-text">{event.location}</p>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {event.description && (
                            <div className="bg-surface rounded-lg p-6 mb-6">
                                <h2 className="text-2xl font-bold mb-4 text-text">About</h2>
                                <p className="text-text">{event.description}</p>
                            </div>
                        )}

                        {/* Hosts */}
                        {event.hostNames && event.hostNames.length > 0 && 
                        ( <div className="bg-surface rounded-lg p-4 mb-6"> 
                            <h2 className="text-2xl font-bold mb-4 text-text">Hosted By</h2>
                        {event.hostNames.map((host,index) => (
                           
                                <a key={host} href={`/hosts/${encodeURIComponent(event.hostIDs ? event.hostIDs[index] : '')}`} className="text-sm font-bold  px-3 py-1 rounded m-2 inline-block text-text bg-accent transition">
                                    {host.trim().replace(/[\[\]']/g, '')}
                                </a>
                        ))}
                        </div>)}  

                        {/* Venue */}
                        <div className="bg-surface rounded-lg p-6 mb-6">
                            <h2 className="text-2xl text-text font-bold mb-4">Venue Information</h2>
                            <a href={`/venues/${encodeURIComponent(event.locationid || '')}`} className="block border rounded-lg p-4 hover:shadow-md transition">
                                <h3 className="font-semibold text-text text-lg mb-2">{event.location}</h3>
                                <div className="flex items-center gap-2 text-muted">
                                    <MapPin size={18} />
                                    <p className="text-sm">{venueAddress}</p>
                                </div>
                            </a>
                        </div>

                        {/* Reviews Section */}
                        <div className="bg-surface rounded-lg p-6">
                            <h2 className="text-2xl font-bold mb-4 text-text">Reviews</h2>
                            <div className="space-y-4">
                                {
                                    eventReviews.length === 0 ? <p className="text-muted">No reviews yet. Be the first to review!</p> :
                                        eventReviews.map((review, index) => (
                                            <DisplayEventReview key={index} review={review} />
                                        ))
                                }
                            </div>
                            <button
                                onClick={() => setIsReviewModalOpen(true)}
                                className="w-full mt-4 px-4 py-2 border rounded-lg hover-bg-accent-soft font-semibold text-text"
                            >
                                Write a Review
                            </button>
                            {isReviewModalOpen &&
                                <ReviewModal
                                    isOpen={isReviewModalOpen}
                                    event={event}
                                    onClose={() => setIsReviewModalOpen(false)}
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
                                        setIsReviewModalOpen(false);
                                    }}
                                />
                            }
                            <ShareModal
                                isOpen={showShareModal}
                                onClose={() => setShowShareModal(false)}
                                entity="events"
                                entityId={event.id}
                                entityTitle={event.title}
                                eventStartAt={eventStartAt}
                            />
                        </div>
                    </div>

                    {/* Right Column - Related Events */}
                    <div>
                        <div className="bg-surface rounded-lg p-6 sticky top-8">
                            <h2 className="text-2xl text-text font-bold mb-4">Related Events</h2>
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
