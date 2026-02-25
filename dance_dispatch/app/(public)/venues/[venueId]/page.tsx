'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Image from 'next/image';
import { MapPin, Clock, Calendar } from 'lucide-react';
import { getEvents, Venue } from '@/lib/utils';
import { SearchResult } from '@/app/components/EventCard';


export default function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = use(params);
    const [venue, setVenue] = useState<Venue | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pastEvents, setPastEvents] = useState<any[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [similarVenues, setSimilarVenues] = useState<Venue[]>([]);

    useEffect(() => {
        const fetchVenue = async () => {
            try {
                const res = await fetch(`/api/venues/${venueId}`);
                const data = await res.json();
                setVenue(data);
            } catch (error) {
                console.error('Failed to fetch venue:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchVenue();
    }, [venueId]);

    useEffect(() => {
        if (!venueId) return;
        const fetchEvents = async () => {
            const re = await getEvents(false, venueId);
            const pastEvents = re
                .filter(event => new Date(`${event.startdate} ${event.starttime}`) < new Date())
                .sort((a, b) => new Date(`${b.startdate} ${b.starttime}`).getTime() - new Date(`${a.startdate} ${a.starttime}`).getTime())
                .slice(0, 5);
            const upcomingEvents = re.filter(event => new Date(`${event.startdate} ${event.starttime}`) >= new Date());
            setPastEvents(pastEvents);
            setUpcomingEvents(upcomingEvents);
        };
        fetchEvents();
    }, [venueId]);
    
    
    useEffect(() => {
        if (!venue) return;
        const fetchSimilarVenues = async () => {
            try {
                const res = await fetch(`/api/venues?type=${venue.type??''}&exclude=${venueId}`);
                const data = await res.json();
                setSimilarVenues(data.slice(0, 5));
            } catch (error) {
                console.error('Failed to fetch similar venues:', error);
            }
        };
        fetchSimilarVenues();
    }, [venue, venueId]);
    
    
    if (loading) return <div className="p-8">Loading...</div>;
    if (!venue) return <div className="p-8">Venue not found</div>;
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Image Gallery */}
            {venue.photourls && 
            <div className="relative h-96 bg-gray-900">
                {venue.photourls.split(',').length > 0 && (
                    <Image
                        src={venue.photourls.split(',')[activeImageIndex] || '/images/default_venue.jpg'}
                        alt={venue.name}
                        fill
                        className="object-cover"
                    />
                )}
                <div className="absolute bottom-4 right-4 flex gap-2">
                    {venue.photourls.split(',').map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveImageIndex(idx)}
                            className={`w-2 h-2 rounded-full ${
                                idx === activeImageIndex ? 'bg-white' : 'bg-gray-400'
                            }`}
                        />
                    ))}
                </div>
            </div>}

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Header */}
                        <section className="mb-8 bg-white p-6 rounded-lg">
                            <div className="flex items-start gap-4 mb-4">
                                <div>
                                    <h2 className="text-sm text-gray-600 uppercase">{venue.type}</h2>
                                    <h1 className="text-4xl text-gray-900 font-bold mt-2">{venue.name}</h1>
                                </div>
                            </div>
                        </section>

                        {/* Bio */}
                        {venue.tags && <section className="mb-8 bg-white p-6 rounded-lg">
                            <h2 className="font-semibold text-gray-900 text-lg mb-4">Tags</h2>
                            <p className="text-gray-700">{venue.bio}</p>
                            <div className="flex flex-wrap gap-2">
                                {venue.tags.split(',').map((feature) => (
                                    <span key={feature} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        </section>}

                        {/* Address & Map */}
                        <section className="mb-8 bg-white p-6 rounded-lg">
                            <div className="flex items-start gap-4 mb-4">
                                <MapPin className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-gray-900 text-lg">Address</h2>
                                    <p className="text-gray-700">{venue.address}</p>
                                </div>
                            </div>
                            {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                                <iframe
                                    width="100%"
                                    height="300"
                                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(venue.address)}`}
                                    className="rounded"
                                    loading="lazy"
                                />
                            ) : (
                                <p className="text-sm text-gray-500">Map not available</p>
                            )}
                        </section>

                        {/* Events */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Upcoming Events */}
                            <section className="bg-white p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-6 h-6 text-purple-500" />
                                    <h2 className="font-semibold text-gray-900 text-lg">Upcoming Events</h2>
                                </div>
                                <div className="space-y-3">
                                    {upcomingEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events"/>

                                        // <div key={event.id} className="border-l-4 border-purple-500 pl-4">
                                        //     <p className="text-gray-900 font-medium">{event.title}</p>
                                        //     <p className="text-sm text-gray-600">
                                        //         {event.startdate} at {event.starttime}
                                        //     </p>
                                        // </div>
                                    ))}
                                </div>
                            </section>

                            {/* Recent Events */}
                            <section className="bg-white p-6 rounded-lg">
                                <h2 className="font-semibold text-gray-900 text-lg mb-4">Recent Events</h2>
                                <div className="space-y-3">
                                    {pastEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events"/>
                                        // <div key={event.id} className="border-l-4 border-gray-300 pl-4">
                                        //     <p className="text-gray-900 font-medium">{event.title}</p>
                                        //     <p className="text-sm text-gray-600">{event.startdate}</p>
                                        // </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div>
                        <section className="bg-white p-6 rounded-lg sticky top-4">
                            <h2 className="font-semibold text-gray-900 text-lg mb-4">Similar Venues</h2>
                            <div className="space-y-4">
                                {similarVenues.map((v) => (
                                    
                                    <a key={v.id} href={`/venues/${v.id}`} className="block hover:bg-gray-50 p-3 rounded border border-gray-200 transition">
                                        <p className="font-medium text-gray-900">{v.name}</p>
                                        <p className="text-sm text-gray-600">{v.type}</p>
                                    </a>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}