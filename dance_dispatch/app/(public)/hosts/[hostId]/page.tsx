'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Image from 'next/image';
import { Calendar, ExternalLink, Globe, Star } from 'lucide-react';
import { SearchResult } from '@/app/components/EventCard';
import { Host } from '@/lib/utils';
import { SoundcloudPlayer } from '@/app/components/MediaPreviews';
import { FollowEntityButton } from '@/app/components/SaveEventButton';


export default function HostPage({ params }: { params: Promise<{ hostId: string }> }) {
    const { hostId } = use(params);
    const [host, setHost] = useState<Host | null>(null);
    const [loading, setLoading] = useState(true);
    const [pastEvents, setPastEvents] = useState<any[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [similarHosts, setSimilarHosts] = useState<Host[]>([]);
    const [hostMedia, setHostMedia] = useState<any[]>([]);
    const [hostComments, setHostComments] = useState<any[]>([]);

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
        const fetchHostMedia = async () => {
            try {
                const res = await fetch(`/api/host-media/${hostId}`);
                const data = await res.json();
                setHostMedia(data);
            } catch (error) {
                console.error('Failed to fetch host media:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHostMedia();
    }, [hostId]);

    useEffect(() => {
        if (!hostId) return;
        const fetchEvents = async () => {
            const res = await fetch(`/api/events?onlyUpcoming=false&hostId=${encodeURIComponent(hostId)}`);
            const events = await res.json();
            const pastEvents = events
                .filter((event: any) => new Date(`${event.startdate} ${event.starttime}`) < new Date())
                .sort((a: { startdate: any; starttime: any; }, b: { startdate: any; starttime: any; }) => new Date(`${b.startdate} ${b.starttime}`).getTime() - new Date(`${a.startdate} ${a.starttime}`).getTime())
                .slice(0, 5);
            const upcomingEvents = events.filter((event: any) => new Date(`${event.startdate} ${event.starttime}`) >= new Date());
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

    useEffect(() => {
        if (!hostId) return;

        const fetchHostComments = async () => {
            try {
                const res = await fetch(`/api/hosts/${hostId}/comments`);
                const data = await res.json();
                setHostComments(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to fetch host comments:', error);
            }
        };

        fetchHostComments();
    }, [hostId]);
    
    
    if (loading) return <div className="p-8">Loading...</div>;
    if (!host) return <div className="p-8">Host not found</div>;

    return (
        <div className="min-h-screen bg-bg text-text">
            {/* Image Gallery */}
            <div className="relative h-96 bg-bg">
                
                    <Image
                        src={host.photoUrl === "" ? '/images/default_host.jpg' : host.photoUrl}
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

                        <section className="bg-surface rounded-lg p-6 mb-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col items-start gap-2">
                                <div className="flex flex-wrap gap-2">
                                    {host.tags?.map((tag) => (
                                        <span key={tag} className="text-sm bg-surface border border-default px-3 py-1 rounded text-white"  style={{ backgroundColor: `hsl(${Math.random() * 360}, 40%, 50%)` }}>
                                            {tag.trim().replace(/[\[\]']/g, '')}
                                        </span>
                                    ))}
                                </div>
                                <h1 className="text-4xl text-text font-bold">{host.name}</h1>

                            </div>

                            <FollowEntityButton entity="hosts" entityId={host.id} />
                        </div>
                        </section>
                       

                        {/* Bio */}
                        {host.bio && (
                            <section className="mb-8 bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-4">About</h2>
                                <p className="text-muted">{host.bio}</p>
                            </section>
                        )}

                        {hostMedia.length > 0 && (
                            <section className="mb-8 bg-surface p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-5 h-5" />
                                    <h2 className="font-semibold text-text text-lg">Links & Mixes</h2>
                                </div>
                                <div className="space-y-3">
                                    {hostMedia.map((media, index) => (
                                        <a key={index}>
                                            <span>{media.type || 'Link'}</span>
                                            <SoundcloudPlayer embedCode={media.embed_code} />
                                        </a>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Events */}
                        <div className="grid md:grid-cols-2 gap-8 mb-8">
                            {/* Upcoming Events */}
                            <section className="bg-surface p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-6 h-6 text-purple-500" />
                                    <h2 className="font-semibold text-text text-lg">Upcoming Events</h2>
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
                            <section className="bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-4">Recent Events</h2>
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
                         {hostComments.length > 0 && (
                                <section className="bg-surface rounded-lg p-6 mb-6">
                                <h2 className="font-semibold text-text text-lg mb-4">Comments</h2>
                                      
                                        

                            {hostComments.map((comment, index) => (
                                        <div key={index} className="flex-shrink-0 min-w-[200px] max-w-[250px]">
                                            <h4 className="text-sm font-semibold text-text mb-2">{comment.privacy_level === 'public' ? comment.user_id : 'Anon'}</h4>
                                            {comment.rating && comment.rating > 0 && (
                                                <div className="flex gap-1 mb-2">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        size={16}
                                                        className={star <= (comment.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                                    />
                                                ))}
                                            </div>
                                            )}
                                            {comment.comment && (
                                                <p className="text-sm text-text">{comment.comment}</p>
                                            )}
                                        </div>
                                    ))}
                                    </section>
                            )}
                    </div>

                    {/* Sidebar */}
                    <div>
                        <section className="bg-surface p-6 rounded-lg sticky top-4">
                            <h2 className="font-semibold text-text text-lg mb-4">You might be interested in...</h2>
                            <div className="space-y-4">
                                {similarHosts.map((h) => (
                                    
                                    <a key={h.id} href={`/hosts/${h.id}`} className="block hover-bg-accent-soft p-3 rounded border border-default hover:border-accent transition">
                                        <p className="font-medium text-text">{h.name}</p>
                                        <p className="text-sm text-muted">{h.tags?.join(', ')}</p>
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