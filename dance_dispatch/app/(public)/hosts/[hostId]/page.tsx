'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Image from 'next/image';
import { MapPin, Clock, Calendar } from 'lucide-react';
import { getEvents, Host } from '@/lib/utils';
import { SearchResult } from '@/app/components/EventCard';


export default function HostPage({ params }: { params: Promise<{ hostId: string }> }) {
    const { hostId } = use(params);
    const [host, setHost] = useState<Host | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pastEvents, setPastEvents] = useState<any[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [similarHosts, setSimilarHosts] = useState<Host[]>([]);

    useEffect(() => {
        const fetchHost = async () => {
            try {
                const res = await fetch(`/api/hosts/${hostId}`);
                const data = await res.json();
                setHost(data);
            } catch (error) {
                console.error('Failed to fetch host:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHost();
    }, [hostId]);

    useEffect(() => {
        if (!hostId) return;
        const fetchEvents = async () => {
            const events = await getEvents(false, undefined, hostId);
            const pastEvents = events
                .filter(event => new Date(`${event.startdate} ${event.starttime}`) < new Date())
                .sort((a, b) => new Date(`${b.startdate} ${b.starttime}`).getTime() - new Date(`${a.startdate} ${a.starttime}`).getTime())
                .slice(0, 5);
            const upcomingEvents = events.filter(event => new Date(`${event.startdate} ${event.starttime}`) >= new Date());
            setPastEvents(pastEvents);
            setUpcomingEvents(upcomingEvents);
        };
        fetchEvents();
    }, [hostId]);
    
    
    useEffect(() => {
        if (!host) return;
        const fetchSimilarHosts = async () => {
            try {
                const res = await fetch(`/api/hosts?tags=${host.tags}&exclude=${hostId}`);
                const data = await res.json();
                setSimilarHosts(data.slice(0, 5));
            } catch (error) {
                console.error('Failed to fetch similar hosts:', error);
            }
        };
        fetchSimilarHosts();
    }, [host, hostId]);
    
    
    if (loading) return <div className="p-8">Loading...</div>;
    if (!host) return <div className="p-8">Host not found</div>;
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Image Gallery */}
            <div className="relative h-96 bg-gray-900">
                
                    <Image
                        src={host.photoUrl ?? '/images/default_host.jpg'}
                        alt={host.name}
                        fill
                        className="object-cover"
                    />

                <div className="absolute bottom-4 right-4 flex gap-2">
                  
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex flex-wrap gap-2">
                                {host.tags.split(',').map((tag) => (
                                    <span key={tag} className="text-sm text-gray-600 bg-gray-200 px-3 py-1 rounded">
                                        {tag.trim().replace(/[\[\]']/g, '')}
                                    </span>
                                ))}
                            </div>
                            <h1 className="text-4xl text-gray-900 font-bold mt-2">{host.name}</h1>
                        </div>

                        {/* Bio */}
                        {host.bio && (
                            <section className="mb-8 bg-white p-6 rounded-lg">
                                <h2 className="font-semibold text-gray-900 text-lg mb-4">About</h2>
                                <p className="text-gray-700">{host.bio}</p>
                            </section>
                        )}

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
                            <h2 className="font-semibold text-gray-900 text-lg mb-4">You might be interested in...</h2>
                            <div className="space-y-4">
                                {similarHosts.map((h) => (
                                    
                                    <a key={h.id} href={`/hosts/${h.id}`} className="block hover:bg-gray-50 p-3 rounded border border-gray-200 transition">
                                        <p className="font-medium text-gray-900">{h.name}</p>
                                        <p className="text-sm text-gray-600">{h.tags}</p>
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