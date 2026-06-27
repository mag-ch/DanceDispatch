import { Event } from '@/lib/utils';
import { getAllFollowedVenues, getAllFollowedHosts, getAllFollowedUsers, getUserById, checkNewUserMissions, getUserReviews } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';
import { getSavedEventsForUserServer, getTopBadgesForUsers, getUserPointsSummary } from '@/lib/server_utils';
import { SearchResult } from '@/app/components/EventCard';
import UserBadgesInline from '@/app/components/UserBadgesInline';
import Link from 'next/link';
import ProfilePictureEditor from './ProfilePictureEditor';
import ExplorerBadgeModal from './ExplorerBadgeModal';
import { DisplayEventReview } from '@/app/components/EventReview';



export default async function ProfilePage() {
    const user = await requireAuth();

    // Fetch all necessary data in parallel from public.profiles
    const userdata = await getUserById(user.id);
    const displayName = userdata?.full_name || userdata?.username || user.email || 'User';
    
    const [followedVenues, favoriteDJs, followedUsers, upcomingEvents, pastEvents, userReviews, missionStatus, pointsSummary] = await Promise.all([
        getAllFollowedVenues(user.id),
        getAllFollowedHosts(user.id),
        getAllFollowedUsers(user.id),
        getSavedEventsForUserServer(user.id, 'upcoming'),
        getSavedEventsForUserServer(user.id, 'past'),
        getUserReviews(user.id),
        checkNewUserMissions(user.id),
        getUserPointsSummary(user.id),
    ]);

    const followedUserBadgeMap = await getTopBadgesForUsers(
        followedUsers.map((follow: any) => String(follow.id)).filter(Boolean),
        1,
    );

    const partiesAttendedTotal = pastEvents.length;
    const memberSince = new Date(user.created_at);
    const now = new Date();
    const monthsActive = Math.max(
        1,
        (now.getFullYear() - memberSince.getFullYear()) * 12 + (now.getMonth() - memberSince.getMonth()) + 1
    );
    const averageEventsPerMonth = partiesAttendedTotal / monthsActive;

    const totalMoneySpent = pastEvents.reduce((sum, event) => {
        const rawPrice = (event as Event).price;
        const normalizedPrice =
            typeof rawPrice === 'number'
                ? rawPrice
                : Number(String(rawPrice ?? '').replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
            return sum;
        }
        return sum + normalizedPrice;
    }, 0);

    const venueVisitCounts = pastEvents.reduce<Record<string, number>>((acc, event) => {
        const venueName = String((event as Event).location ?? '').trim() || 'Unknown Venue';
        acc[venueName] = (acc[venueName] ?? 0) + 1;
        return acc;
    }, {});

    const topVisitedVenues = Object.entries(venueVisitCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    const moneyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    });

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
                        <p className="text-xl font-semibold text-text flex items-center gap-2">
                            <span>{userdata.username || 'Not provided'}</span>
                            <UserBadgesInline userId={user.id} maxBadges={3} />
                        </p>
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

            {missionStatus.allComplete && (
                <section className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-text">Achievements</h2>
                    <ExplorerBadgeModal missionStatus={missionStatus} />
                </section>
            )}

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Stats</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-default bg-surface p-5">
                        <p className="text-sm text-muted">Parties Attended</p>
                        <p className="mt-2 text-3xl font-bold text-text">{partiesAttendedTotal}</p>
                    </div>

                    <div className="rounded-xl border border-default bg-surface p-5">
                        <p className="text-sm text-muted">Average Events / Month</p>
                        <p className="mt-2 text-3xl font-bold text-text">{averageEventsPerMonth.toFixed(1)}</p>
                    </div>

                    <div className="rounded-xl border border-default bg-surface p-5">
                        <p className="text-sm text-muted">Total Ticket Spend</p>
                        <p className="mt-2 text-3xl font-bold text-text">{moneyFormatter.format(totalMoneySpent)}</p>
                    </div>

                    <div className="rounded-xl border border-default bg-surface p-5">
                        <p className="text-sm text-muted mb-2">Top 3 Visited Venues</p>
                        {topVisitedVenues.length > 0 ? (
                            <ol className="space-y-1 text-sm text-text">
                                {topVisitedVenues.map(([venueName, visits]) => (
                                    <li key={venueName} className="flex items-center justify-between gap-2">
                                        <span className="truncate">{venueName}</span>
                                        <span className="text-muted">{visits}x</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="text-sm text-muted">No venue attendance yet.</p>
                        )}
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-yellow-400/30 bg-gradient-to-br from-yellow-50 to-surface p-5 shadow-sm dark:from-yellow-400/10 dark:to-surface">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-sm text-muted">Points Earned</p>
                            <p className="mt-2 text-3xl font-bold text-text">{pointsSummary.totalPoints.toLocaleString()}</p>
                        </div>
                        <Link href="/leaderboard" className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold w-fit">
                            View leaderboard
                        </Link>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-sm">
                        {Object.keys(pointsSummary.breakdown).length === 0 ? (
                            <span className="text-muted">Earn points by RSVPing, sharing, reviewing, and referring.</span>
                        ) : (
                            Object.entries(pointsSummary.breakdown).map(([action, points]) => (
                                <span key={action} className="rounded-full border border-border bg-bg px-3 py-1 text-text">
                                    {action}: {points}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Followed Users */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Following ({followedUsers.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {followedUsers.map((follow) => (
                        <SearchResult key={follow.id} header={follow.username} img={follow.profile_picture} subheader={follow.full_name} entityId={follow.id} entity="users" badgeUserId={follow.id} topBadges={followedUserBadgeMap[String(follow.id)] ?? []} />                    ))}
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
                    {
                    userReviews.map((review, index) => (
                        <DisplayEventReview key={index} review={review} />
                    ))}
                    {userReviews.length === 0 && (
                        <p className="text-text">No past comments</p>
                    )}
                </div>
            </section>
        </div>
    );
}