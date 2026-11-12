"use client";

import { useMemo, useState } from "react";
import { SearchResult } from "@/app/components/EventCard";
import UserBadgesInline from "@/app/components/UserBadgesInline";
import { Event, EventReview, Host, Venue } from "@/lib/utils";
import { FollowEntityButton } from "@/app/components/SaveEventButton";
import { DisplayEventReview } from "@/app/components/EventReview";
import { useRouter } from "next/navigation";
import BlockUserButton from "@/app/components/BlockUserButton";
import SearchableListModal from "@/app/components/SearchableListModal";
import ProfileDetails from "@/app/components/ProfileDetails";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_picture: string | null;
  created_at: string;
  bio?: string | null;
  genres?: string[] | null;
};

type UserProfileClientProps = {
  user: Profile;
  followedVenues: Venue[];
  followedHosts: Host[];
  followedUsers: Profile[];
  upcomingEvents: Event[];
  pastEvents: Event[];
  userReviews: EventReview[];
  canSeeActivity: boolean;
  isOwnProfile: boolean;
  canManageBlock: boolean;
  isBlocked: boolean;
};

export default function UserProfileClient({
  user,
  followedVenues,
  followedHosts,
  followedUsers,
  upcomingEvents,
  pastEvents,
  userReviews,
  canSeeActivity,
  isOwnProfile,
  canManageBlock,
  isBlocked,
}: UserProfileClientProps) {
  const router = useRouter();
  const [activeFollowModal, setActiveFollowModal] = useState<"venues" | "hosts" | "users" | null>(null);

  const displayName = user.username || "User";
  const profilePicture = user.profile_picture || "/images/default_users.jpg";

  const modalConfig = useMemo(() => {
    if (activeFollowModal === "venues") {
      return {
        title: "Followed Venues",
        emptyText: "No followed venues.",
        content: followedVenues.map((venue) => (
          <SearchResult
            key={venue.id}
            header={venue.name}
            subheader={venue.bio}
            location={venue.address}
            img={venue.photourls}
            entityId={venue.id}
            entity="venues"
            showActions
          />
        )),
      };
    }

    if (activeFollowModal === "hosts") {
      return {
        title: "Followed Hosts",
        emptyText: "No followed hosts.",
        content: followedHosts.map((host) => (
          <SearchResult
            key={host.id}
            header={host.name}
            subheader={[host.host_type, ...(host.genres ?? [])].filter(Boolean).join(", ")}
            img={host.photoUrl}
            entityId={host.id}
            entity="hosts"
            showActions
          />
        )),
      };
    }

    if (activeFollowModal === "users") {
      return {
        title: "Followed Users",
        emptyText: "Not following any users.",
        content: followedUsers.map((followed) => (
          <SearchResult
            key={followed.id}
            header={followed.full_name || followed.username || "User"}
            subheader={followed.username ? `@${followed.username}` : "User profile"}
            img={followed.profile_picture ?? '/images/default_users.jpg'}
            entityId={followed.id}
            entity="users"
            badgeUserId={followed.id}
            showActions
          />
        )),
      };
    }

    return null;
  }, [activeFollowModal, followedHosts, followedUsers, followedVenues]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <section className="bg-surface rounded-lg p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <img
                src={profilePicture}
                alt={displayName}
                className="h-20 w-20 rounded-full object-cover"
              />
              <div>
<h1 className="text-3xl font-bold flex items-center gap-2">
                  <span>{displayName}</span>
                  <UserBadgesInline userId={user.id} maxBadges={3} showNames />
                </h1>
                {user.full_name && <p className="text-sm text-text/80">{user.full_name }</p>}
                <p className="text-sm text-text/80">Joined {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {!isOwnProfile && <div className="flex flex-wrap items-start gap-3">
              {!isBlocked && <FollowEntityButton entity="users" entityId={user.id} onFollowChange={() => router.refresh()} />}
              {canManageBlock && <BlockUserButton userId={user.id} name={displayName} isBlocked={isBlocked} />}
            </div>}
          </div>
          <ProfileDetails bio={user.bio ?? null} genres={user.genres ?? null} />
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">Following</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveFollowModal("venues")}
              className="rounded-lg border border-text/10 bg-surface px-6 py-8 text-center transition hover:border-accent hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <p className="text-4xl font-bold text-text">{followedVenues.length}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-text/70">Venues</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveFollowModal("hosts")}
              className="rounded-lg border border-text/10 bg-surface px-6 py-8 text-center transition hover:border-accent hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <p className="text-4xl font-bold text-text">{followedHosts.length}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-text/70">Hosts</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveFollowModal("users")}
              className="rounded-lg border border-text/10 bg-surface px-6 py-8 text-center transition hover:border-accent hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <p className="text-4xl font-bold text-text">{followedUsers.length}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-text/70">Users</p>
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Recent Events Attended ({pastEvents.length})</h2>
          <div className="space-y-3">
            {pastEvents.slice(0, 8).map((event, index) => (
              <SearchResult
                key={`${event.id}-${index}`}
                header={event.title}
                subheader={event.description}
                date={`${event.startdate} ${event.starttime}`}
                location={event.location}
                img={event.imageurl}
                entityId={event.id}
                entity="events"
                event={event}
              />
            ))}
            {pastEvents.length === 0 && <p className="text-sm text-text/80">No recent attended events.</p>}
          </div>
        </section>

        {canSeeActivity ? <section>
          <h2 className="text-2xl font-semibold mb-4">Upcoming Events ({upcomingEvents.length})</h2>
          <div className="space-y-3">
            {upcomingEvents.slice(0, 8).map((event, index) => (
              <SearchResult
                key={`${event.id}-${index}`}
                header={event.title}
                subheader={event.description}
                date={`${event.startdate} ${event.starttime}`}
                location={event.location}
                img={event.imageurl}
                entityId={event.id}
                entity="events"
                event={event}
              />
            ))}
            {upcomingEvents.length === 0 && <p className="text-sm text-text/80">No upcoming events.</p>}
          </div>
        </section> : (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Upcoming Events and Reviews</h2>
            <p className="text-sm text-text/80">Follow this user to see their upcoming events and reviews.</p>
          </section>
        )}

        {canSeeActivity && <section>
          <h2 className="text-2xl font-semibold mb-4">Recent Reviews and Comments ({userReviews.length})</h2>
          <div className="space-y-3">
            {userReviews.slice(0, 10).map((review,id) => (
              <div key={id} className="[&_video]:max-h-40 [&_img]:max-h-40 [&_video]:object-cover [&_img]:object-cover">
                  <DisplayEventReview review={review} />
              </div>
              // <div key={id} className="bg-surface rounded-lg p-4 border border-text/10">
              //   <p className="text-sm text-text/80">Event #{review.eventName}</p>
              //   {review.rating !== null && review.rating !== undefined && (
              //     <p className="font-medium">Rating: {review.rating}/5</p>
              //   )}
              //   {review.comment && <p>{review.comment}</p>}
              //   <p className="text-xs text-text/70 mt-2">{new Date(review.created_at).toLocaleDateString()}</p>
              // </div>
            ))}
            {userReviews.length === 0 && <p className="text-sm text-text/80">No recent reviews or comments.</p>}
          </div>
        </section>}
      </div>

      {modalConfig && <SearchableListModal title={modalConfig.title} count={modalConfig.content.length}
        emptyMessage={modalConfig.emptyText} onClose={() => setActiveFollowModal(null)}>
        {modalConfig.content}
      </SearchableListModal>}
    </div>
  );
}
