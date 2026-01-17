'use client';
import { useState, useEffect } from 'react';
import { Event, getEvents, getHosts, Venue, Host, getVenues } from '@/lib/utils';
import { createClient } from "@/lib/supabase/server";
import type { User } from '@supabase/supabase-js';

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [followedVenues, setFollowedVenues] = useState<Venue[]>([]);
    const [favoriteDJs, setFavoriteDJs] = useState<Host[]>([]);

    useEffect(() => {
        const fetchUserId = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        }
        fetchUserId();
    }, [user]);

    useEffect(() => {
        const fetchData = async () => {
            const events = await getEvents();
            const venues = await getVenues();
            const djs = await getHosts();
            setUpcomingEvents(events);
            setFollowedVenues(venues);
            setFavoriteDJs(djs);
        };
        fetchData();
    }, []);

    if (!user) return <div>Loading...</div>;
    
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold text-gray-700 mb-8">My Profile</h1>
                <h2 className="text-2xl text-gray-700 font-semibold mb-4">{user.id}</h2>
            {/* Status Message */}
            <section className="mb-8 p-6 rounded-lg">
                <h2 className="text-2xl text-gray-700 font-semibold mb-4">Status</h2>
                <textarea
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full p-3 rounded text-gray-900 mb-3 border border-gray-300"
                    rows={3}
                />
                <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded">
                    Update Status
                </button>
            </section>

            {/* Upcoming Events */}
            <section className="mb-8">
                <h2 className="text-2xl text-gray-700 font-semibold mb-4">Upcoming Events</h2>
                <div className="grid gap-4">
                    {upcomingEvents.map((event:Event) => (
                        <div key={event.id} className=" p-4 rounded-lg">
                            <h3 className=" text-gray-700 font-semibold">{event.title}</h3>
                            <p className="text-gray-400">{event.startdate}</p>
                            <p className="text-gray-400">{event.location}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Followed Venues */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Followed Venues</h2>
                <div className="grid gap-4">
                    {followedVenues.map((venue) => (
                        <div key={venue.id} className=" p-4 rounded-lg">
                            <h3 className=" text-gray-700 font-semibold">{venue.name}</h3>
                            <p className="text-gray-400">{venue.address}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Favorite DJs */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">Favorite DJs</h2>
                <div className="grid gap-4">
                    {favoriteDJs.map((dj) => (
                        <div key={dj.id} className=" p-4 rounded-lg">
                            <h3 className=" text-gray-700 font-semibold">{dj.name}</h3>
                            <p className="text-gray-400">{dj.tags}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>  
    );
}