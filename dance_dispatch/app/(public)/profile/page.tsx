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
import ExpandableList from '@/app/components/ExpandableList';
import CollapsedSectionModal from '@/app/components/CollapsedSectionModal';
import NotificationSubscriptionToggle from './NotificationSubscriptionToggle';
import MakePartyPlanButton from './MakePartyPlanButton';


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
        getUserReviews(user.id, true),
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

    // Most recent past events first, so "see more" reveals older history
    const sortedPastEvents = [...pastEvents].sort((a: Event, b: Event) => {
        const aTime = new Date(`${a.startdate ?? ''} ${a.starttime ?? ''}`).getTime();
        const bTime = new Date(`${b.startdate ?? ''} ${b.starttime ?? ''}`).getTime();
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });

    // Pre-render item lists so they can be handed to client components as children
    const followedUserItems = followedUsers.map((follow: any) => (
        <SearchResult
            key={follow.id}
            header={follow.username}
            img={follow.profile_picture}
            subheader={follow.full_name}
            entityId={follow.id}
            entity="users"
            badgeUserId={follow.id}
            topBadges={followedUserBadgeMap[String(follow.id)] ?? []}
        />
    ));

    const followedVenueItems = followedVenues.map((venue: any, index: number) => (
        <SearchResult
            key={`${venue.id}-${index}`}
            header={venue.name}
            subheader={venue.description}
            location={venue.address}
            img={venue.photourls}
            entityId={venue.id}
            entity="venues"
        />
    ));

    const favoriteDJItems = favoriteDJs.map((host: any, index: number) => (
        <SearchResult
            key={`${host.id}-${index}`}
            header={host.name}
            subheader={host.tags?.join(', ')}
            location={host.address}
            img={host.photoUrl}
            entityId={host.id}
            entity="hosts"
        />
    ));

    const pastEventItems = sortedPastEvents.map((event: Event, index: number) => (
        <SearchResult
            key={`${event.id}-${index}`}
            header={event.title}
            subheader={event.description}
            date={event.startdate + " " + event.starttime}
            price={event.price}
            location={event.location}
            img={event.imageurl}
            entityId={event.id}
            entity="events"
        />
    ));

    const reviewItems = userReviews.map((review, index) => (
        <div
            key={index}
            className="[&_.aspect-square]:!max-w-[160px] [&_.aspect-square]:!max-h-[160px] [&_.aspect-square_img]:!object-cover [&_.aspect-square_video]:!object-cover"
        >
            <DisplayEventReview review={review} />
        </div>
    ));

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
                    <NotificationSubscriptionToggle />
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
            <CollapsedSectionModal
                title="Following"
                count={followedUsers.length}
                emptyMessage="Not following anyone yet"
                discoverHref="/search?categories=users"
                discoverLabel="Discover Users"
            >
                {followedUserItems}
            </CollapsedSectionModal>

            {/* Favorite Venues */}
            <CollapsedSectionModal
                title="Favorite Venues"
                count={followedVenues.length}
                emptyMessage="No favorite venues yet"
                discoverHref="/search?categories=venues"
                discoverLabel="Discover Venues"
            >
                {followedVenueItems}
            </CollapsedSectionModal>

            {/* Favorite DJs */}
            <CollapsedSectionModal
                title="Favorite DJs"
                count={favoriteDJs.length}
                emptyMessage="No favorite DJs yet"
                discoverHref="/search?categories=hosts"
                discoverLabel="Discover DJs"
            >
                {favoriteDJItems}
            </CollapsedSectionModal>

            {/* Upcoming Events - kept fully displayed */}
            <section className="mb-8">
                <div className="mb-4 flex flex-col gap-3">
                    <h2 className="text-2xl font-semibold text-text">Upcoming Events ({upcomingEvents.length})</h2>
                    <div className="w-fit self-start">
                        <MakePartyPlanButton
                            upcomingEvents={upcomingEvents.map((event: Event) => ({
                                id: event.id,
                                title: event.title,
                                startdate: event.startdate,
                                starttime: event.starttime,
                                location: event.location,
                                price: event.price,
                            }))}
                        />
                    </div>
                </div>
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

            {/* Past Events - only 5 most recent shown, rest behind "See more" */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Past Events ({pastEvents.length})</h2>
                <ExpandableList
                    items={pastEventItems}
                    initialCount={5}
                    emptyMessage="No past events"
                />
            </section>

           {/* Past Comments - only 5 most recent shown, rest behind "See more" */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-text">Reviews ({userReviews.length})</h2>
                <ExpandableList
                    items={reviewItems}
                    initialCount={5}
                    emptyMessage="No past comments"
                />
            </section>
        </div>
    );
}
