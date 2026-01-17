'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { MapPin, Calendar, Users, Share2, Heart } from 'lucide-react';
import { getRelatedEvents, Event } from '@/lib/utils';


export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
    const [eventId, setEventId] = useState<string | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [isRsvped, setIsRsvped] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);

    useEffect(() => {
        // Unwrap params promise
        params.then(({ eventId }) => setEventId(eventId));
    }, [params]);

    useEffect(() => {
        if (!eventId) return;
        
        const fetchEvent = async () => {
            const res = await fetch(`/api/events/${eventId}`);
            const data = await res.json();
            setEvent(data);
        };
        fetchEvent();
    }, [eventId]);

    useEffect(() => {
        if (!event) return;
        const fetchRelatedEvents = async () => {
            const related = await getRelatedEvents(event, 3);
            setRelatedEvents(related);
        };
        fetchRelatedEvents();
    }, [event]);

    if (!event) return <div>Loading...</div>;


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
                    <button
                        onClick={async () => {
                        setIsSaved(!isSaved);
                        await fetch(`/api/users/saved-events`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ eventId: event.id, saveToggle: !isSaved })
                        });
                        }}
                        className="p-2 border rounded-lg hover:bg-gray-100"
                    >
                        <Heart fill={isSaved ? 'currentColor' : 'none'} className="text-red-500" />
                    </button>
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
                        {/* <p className="font-semibold text-gray-700">{params.event.attendees} going</p> */}
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
                        <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-gray-700">John Doe</p>
                                <div className="flex text-yellow-400">★★★★★</div>
                            </div>
                            <p className="text-gray-600 text-sm">Great event! Had an amazing time dancing with friends.</p>
                        </div>
                        <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-gray-700">Jane Smith</p>
                                <div className="flex text-yellow-400">★★★★</div>
                            </div>
                            <p className="text-gray-600 text-sm">Good music and crowd, but venue could be cooler.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowReviewModal(true)}
                        className="w-full mt-4 px-4 py-2 border rounded-lg hover:bg-gray-50 font-semibold text-gray-700"
                    >
                        Write a Review
                    </button>
                    {showReviewModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
                                <h3 className="text-xl font-bold mb-4 text-gray-900">Write a Review</h3>
                                <div className="space-y-4">
                                    <textarea 
                                        placeholder="Share your experience..." 
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                                        rows={4}
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setShowReviewModal(false)}
                                            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 font-semibold"
                                        >
                                            Cancel
                                        </button>
                                        <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                                            Submit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </div>

                {/* Right Column - Related Events */}
                <div>
                <div className="bg-white rounded-lg p-6 sticky top-8">
                    <h2 className="text-2xl text-gray-700 font-bold mb-4">Related Events</h2>
                    <div className="space-y-4">
                    {relatedEvents.map((relEvent) => (
                        <div
                        key={relEvent.id}
                        className="border rounded-lg overflow-hidden hover:shadow-md transition cursor-pointer"
                        >
                        <div className="relative w-full h-32 bg-gray-200">
                            <Image
                            src={relEvent.imageurl ? relEvent.imageurl : '/images/default_event.jpg'}
                            alt={relEvent.title}
                            fill
                            className="object-cover"
                            />
                        </div>
                        <div className="p-3">
                            <p className="font-semibold text-gray-600 text-sm">{relEvent.title}</p>
                            <p className="text-xs text-gray-600">{relEvent.startdate}</p>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </div>
            </div>
            </div>
        </div>
    );
}