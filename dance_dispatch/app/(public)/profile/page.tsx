'use client';

import { redirect } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Event, Venue, Host, getAllSavedEventsForUser, getAllFollowedVenues, getAllFollowedHosts } from '@/lib/utils';
import { supabase } from "@/lib/supabase/client";
import type { User } from '@supabase/supabase-js';


export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);

    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    // const [followedUsers, setFollowedUsers] = useState<User[]>([]);
    const [followedVenues, setFollowedVenues] = useState<Venue[]>([]);
    const [favoriteDJs, setFavoriteDJs] = useState<Host[]>([]);

    useEffect(() => {
            const fetchUserId = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
            }
            fetchUserId();
        }, []);

    useEffect(() => {
            const fetchFollowedData = async () => {
                try {
                    const [upcomingEvents, followedVenues, favoriteDJs] = await Promise.all([
                        getAllSavedEventsForUser(user!.id),
                        getAllFollowedVenues(user!.id),
                        getAllFollowedHosts(user!.id)
                    ]);
                    setUpcomingEvents(upcomingEvents);
                    setFollowedVenues(followedVenues);
                    setFavoriteDJs(favoriteDJs);
                }
                catch (error) {
                    console.error('Failed to fetch followed data:', error);
                }
            }
            fetchFollowedData();
        }, [user]);

    if (!user) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-gray-900">My Profile</h1>

            <section className="mb-8 bg-gray-50 rounded-lg p-6">
                {user.user_metadata?.full_name && <div className="space-y-2">
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="text-xl font-semibold text-gray-900">{user.user_metadata?.full_name || 'Not provided'}</p>
                </div>}
                {user.user_metadata?.username && <div className="space-y-2 mt-4">
                    <p className="text-sm text-gray-600">Username</p>
                    <p className="text-xl font-semibold text-gray-900">{user.user_metadata?.username || 'Not provided'}</p>
                </div>}
                <div className="space-y-2 mt-4">
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-xl font-semibold text-gray-900">{user.email}</p>
                </div>
                <div className="space-y-2 mt-4">
                    <p className="text-sm text-gray-600">Member Since</p>
                    <p className="text-xl font-semibold text-gray-900">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
            </section>
            {/* Followed Users */}
            {/* <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Following ({user.following.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.following.map((follow) => (
                        <div key={follow.id} className="border rounded-lg p-4">
                            <p className="font-medium">{follow.followedUser.name}</p>
                            <p className="text-sm text-gray-600">{follow.followedUser.email}</p>
                        </div>
                    ))}
                    {user.following.length === 0 && (
                        <p className="text-gray-500">Not following anyone yet</p>
                    )}
                </div>
            </section> */}

            {/* Favorite Venues */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">Favorite Venues ({followedVenues.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {followedVenues.map((fav) => (
                        <div key={fav.id} className="border rounded-lg p-4">
                            <p className="font-medium text-gray-700">{fav.name}</p>
                            <p className="text-sm text-gray-600">{fav.address}</p>
                        </div>
                    ))}
                    {followedVenues.length === 0 && (
                        <p className="text-gray-500">No favorite venues yet</p>
                    )}
                </div>
            </section>

            {/* Favorite DJs */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">Favorite DJs ({favoriteDJs.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoriteDJs.map((fav) => (
                        <div key={fav.id} className="border rounded-lg p-4">
                            <p className="font-medium text-gray-700">{fav.name}</p>
                            <p className="text-sm text-gray-600">{fav.tags}</p>
                        </div>
                    ))}
                    {favoriteDJs.length === 0 && (
                        <p className="text-gray-500">No favorite DJs yet</p>
                    )}
                </div>
            </section>

            {/* Upcoming Events */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700">Upcoming Events ({upcomingEvents.length})</h2>
                <div className="space-y-4">
                    {upcomingEvents.map((event) => (
                        <div key={event.id} className="border rounded-lg p-4">
                            <p className="font-medium text-gray-700">{event.title}</p>
                                <p className="text-sm text-gray-600">{event.location}</p>
                            <p className="text-sm text-gray-500">
                                {new Date(event.startdate).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                    {upcomingEvents.length === 0 && (
                        <p className="text-gray-500">No upcoming events</p>
                    )}
                </div>
            </section>

            {/* Past Comments */}
            {/* <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Recent Comments</h2>
                <div className="space-y-4">
                    {user.comments.map((comment) => (
                        <div key={comment.id} className="border rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-2">
                                On {comment.event.name} - {new Date(comment.createdAt).toLocaleDateString()}
                            </p>
                            <p>{comment.content}</p>
                        </div>
                    ))}
                    {user.comments.length === 0 && (
                        <p className="text-gray-500">No comments yet</p>
                    )}
                </div>
            </section> */}
        </div>
    );
}