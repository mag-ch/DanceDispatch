import { Event } from '@/lib/utils';
import { getAllFollowedVenues, getAllFollowedHosts, getAllFollowedUsers, getUserById } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';
import { getSavedEventsForUserServer, getUserReviews } from '@/lib/server_utils';
import { SearchResult } from '@/app/components/EventCard';
import Link from 'next/link';
import ProfilePictureEditor from './ProfilePictureEditor';



export default async function ProfilePage() {
    const user = await requireAuth();

    // Fetch all necessary data in parallel from public.profiles
    const userdata = await getUserById(user.id);
    const displayName = userdata?.full_name || userdata?.username || user.email || 'User';
    
    const [followedVenues, favoriteDJs, followedUsers, upcomingEvents, pastEvents, userReviews] = await Promise.all([
        getAllFollowedVenues(user.id),
        getAllFollowedHosts(user.id),
        getAllFollowedUsers(user.id),
        getSavedEventsForUserServer(user.id, 'upcoming'),
        getSavedEventsForUserServer(user.id, 'past'),
        getUserReviews(user.id),
    ]);

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-text">My Profile</h1>

            <div className="mb-8 flex flex-col md:flex-row gap-6 items-stretch">
                <div className=" text-text rounded-lg p-6 flex items-center justify-center">
                    <ProfilePictureEditor
                        initialImageUrl={userdata?.profile_picture ?? null}
                        displayName={displayName}
                    />
                </div>

                <section className="bg-surface text-text rounded-lg p-6 flex-1">
                    {userdata?.full_name && <div className="space-y-2">
                        <p className="text-sm text-text">Full Name</p>
                        <p className="text-xl font-semibold text-text">{userdata.full_name || 'Not provided'}</p>
                    </div>}
                    {userdata?.username && <div className="space-y-2 mt-4">
                        <p className="text-sm text-text">Username</p>
                        <p className="text-xl font-semibold text-text">{userdata.username || 'Not provided'}</p>
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
            </div>
            {/* Followed Users */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Following ({followedUsers.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {followedUsers.map((follow) => (
                        <SearchResult key={follow.id} header={follow.username} img={follow.profile_picture} subheader={follow.full_name} entityId={follow.id} entity="users"/>
                    ))}
                    {followedUsers.length === 0 && (
                        <div>
                        <p className="text-gray-500">Not following anyone yet</p>
                        <Link
                        className="btn-highlight bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10 w-fit"
                        href="/search?categories=users"
                    >
                        Discover Users
                    </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Favorite Venues */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Favorite Venues ({followedVenues.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {followedVenues.map((venue: any, index: number) => (
                                        <SearchResult key={`${venue.id}-${index}`} header={venue.name} subheader={venue.description} location={venue.address} img={venue.photourls} entityId={venue.id} entity="venues"/>
                                      ))}  
                    {followedVenues.length === 0 && (
                        <div>
                        <p className="text-text">No favorite venues yet</p>
                        <Link
                        className="btn-highlight bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10 w-fit"
                        href="/search?categories=venues"
                    >
                        Discover Venues
                    </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Favorite DJs */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Favorite DJs ({favoriteDJs.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favoriteDJs.map((host: any, index: number) => (
                                        <SearchResult key={`${host.id}-${index}`} header={host.name} subheader={host.tags?.join(', ')} location={host.address} img={host.photoUrl} entityId={host.id} entity="hosts"/>
                                      ))}  
                    {favoriteDJs.length === 0 && (
                        <div>
                        <p className="text-gray-500">No favorite DJs yet</p>
                        <Link
                        className="btn-highlight bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10 w-fit"
                        href="/search?categories=hosts"
                    >
                        Discover DJs
                    </Link>
                    </div>
                    )}
                </div>
            </section>

            {/* Upcoming Events */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Upcoming Events ({upcomingEvents.length})</h2>
                <div className="space-y-4">

                    {upcomingEvents.map((event: Event, index: number) => (
                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events"/>
                        ))}
                    {upcomingEvents.length === 0 && (
                        <div>
                        <p className="text-text">No upcoming events</p>
                        <Link
                        className="btn-highlight bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10 w-fit"
                        href="/search?categories=events"
                    >
                        Discover Events
                    </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Past Events */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Past Events ({pastEvents.length})</h2>
                <div className="space-y-4">
                    {pastEvents.map((event: Event, index: number) => (
                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events"/>
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
                            <p className="font-medium text-text">{review.event_title}</p>
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