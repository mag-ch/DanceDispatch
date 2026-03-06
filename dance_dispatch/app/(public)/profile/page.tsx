import { Event } from '@/lib/utils';
import { getAllFollowedVenues, getAllFollowedHosts } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';
import { getSavedEventsForUserServer, getUserReviews } from '@/lib/server_utils';



export default async function ProfilePage() {
    const user = await requireAuth();

    const [followedVenues, favoriteDJs, upcomingEvents, pastEvents, userReviews] = await Promise.all([
        getAllFollowedVenues(user.id),
        getAllFollowedHosts(user.id),
        getSavedEventsForUserServer(user.id, 'upcoming'),
        getSavedEventsForUserServer(user.id, 'past'),
        getUserReviews(user.id),
    ]);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-text">My Profile</h1>

            <section className="mb-8 bg-surface text-text rounded-lg p-6">
                {user.user_metadata?.full_name && <div className="space-y-2">
                    <p className="text-sm text-text">Full Name</p>
                    <p className="text-xl font-semibold text-text">{user.user_metadata?.full_name || 'Not provided'}</p>
                </div>}
                {user.user_metadata?.username && <div className="space-y-2 mt-4">
                    <p className="text-sm text-text">Username</p>
                    <p className="text-xl font-semibold text-text">{user.user_metadata?.username || 'Not provided'}</p>
                </div>}
                <div className="space-y-2 mt-4">
                    <p className="text-sm text-text">Email</p>
                    <p className="text-xl font-semibold text-text">{user.email}</p>
                </div>
                <div className="space-y-2 mt-4">
                    <p className="text-sm text-text">Member Since</p>
                    <p className="text-xl font-semibold text-text">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
            </section>
            {/* Followed Users */}
            {/* <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Following ({user.following.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.following.map((follow) => (
                        <div key={follow.id} className="border rounded-lg p-4">
                            <p className="font-medium text-text">{follow.followedUser.name}</p>
                            <p className="text-sm text-text">{follow.followedUser.email}</p>
                        </div>
                    ))}
                    {user.following.length === 0 && (
                        <p className="text-gray-500">Not following anyone yet</p>
                    )}
                </div>
            </section> */}

            {/* Favorite Venues */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Favorite Venues ({followedVenues.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {followedVenues.map((fav) => (
                        <div key={fav.id} className="border rounded-lg p-4">
                            <p className="font-medium text-text">{fav.name}</p>
                            <p className="text-sm text-text">{fav.address}</p>
                        </div>
                    ))}
                    {followedVenues.length === 0 && (
                        <p className="text-text">No favorite venues yet</p>
                    )}
                </div>
            </section>

            {/* Favorite DJs */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Favorite DJs ({favoriteDJs.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoriteDJs.map((fav) => (
                        <div key={fav.id} className="border rounded-lg p-4">
                            <p className="font-medium text-text">{fav.name}</p>
                            <p className="text-sm text-text">{fav.tags}</p>
                        </div>
                    ))}
                    {favoriteDJs.length === 0 && (
                        <p className="text-gray-500">No favorite DJs yet</p>
                    )}
                </div>
            </section>

            {/* Upcoming Events */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Upcoming Events ({upcomingEvents.length})</h2>
                <div className="space-y-4">
                    {upcomingEvents.map((event) => (
                        <div key={event.id} className="border rounded-lg p-4">
                            <p className="font-medium text-text">{event.title}</p>
                                <p className="text-sm text-text">{event.location}</p>
                            <p className="text-sm text-text">
                                {new Date(event.startdate).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                    {upcomingEvents.length === 0 && (
                        <p className="text-text">No upcoming events</p>
                    )}
                </div>
            </section>

            {/* Past Events */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Past Events ({pastEvents.length})</h2>
                <div className="space-y-4">
                    {pastEvents.map((event) => (
                        <div key={event.id} className="border rounded-lg p-4">
                            <p className="font-medium text-text">{event.title}</p>
                                <p className="text-sm text-text">{event.location}</p>
                            <p className="text-sm text-text">
                                {new Date(event.startdate).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                    {pastEvents.length === 0 && (
                        <p className="text-text">No past events</p>
                    )}
                </div>
            </section>

            {/* Past Comments */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Reviews ({userReviews.length})</h2>
                <div className="space-y-4">
                    {userReviews.map((review) => (
                        <div key={review.id} className="border rounded-lg p-4">
                            <p className="font-medium text-text">{review.event_id}</p>
                                <p className="text-sm text-text">{review.comment}</p>
                            <p className="text-sm text-text">
                                {new Date(review.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                    {userReviews.length === 0 && (
                        <p className="text-text">No past comments</p>
                    )}
                </div>
            </section>
        </div>
    );
}