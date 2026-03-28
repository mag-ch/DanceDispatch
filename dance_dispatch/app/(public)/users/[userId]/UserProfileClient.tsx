"use client";

import { useMemo, useState } from "react";
import { SearchResult } from "@/app/components/EventCard";
import { Event, Host, Venue } from "@/lib/utils";
import CustomLink from "@/app/components/CustomLink";
import { FollowEntityButton } from "@/app/components/SaveEventButton";

type UserProfileClientProps = {
  user: any;
  followedVenues: Venue[];
  followedHosts: Host[];
  followedUsers: any[];
  upcomingEvents: Event[];
  pastEvents: Event[];
  userReviews: Array<{
    id: string | number;
    event_id: string | number;
    event_title: string;
    rating?: number | null;
    comment?: string | null;
    created_at: string;
  }>;
};

export default function UserProfileClient({
  user,
  followedVenues,
  followedHosts,
  followedUsers,
  upcomingEvents,
  pastEvents,
  userReviews,
}: UserProfileClientProps) {
  if (!user?.id) {
    return <div className="min-h-screen bg-bg text-text p-6">User not found.</div>;
  }

  const [activeFollowModal, setActiveFollowModal] = useState<"venues" | "hosts" | "users" | null>(null);

  const displayName = user.username || "User";
  const profilePicture = user.profile_picture || "/images/default_event.jpg";

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
            subheader={Array.isArray(host.tags) ? host.tags.join(", ") : String(host.tags || "")}
            img={host.photoUrl}
            entityId={host.id}
            entity="hosts"
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
            img={followed.profile_picture}
            entityId={followed.id}
            entity="users"
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
                <h1 className="text-3xl font-bold">{displayName}</h1>
                {user.full_name && <p className="text-sm text-text/80">{user.full_name }</p>}
                <p className="text-sm text-text/80">Joined {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <FollowEntityButton entity="users" entityId={user.id} />
          </div>
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
              />
            ))}
            {pastEvents.length === 0 && <p className="text-sm text-text/80">No recent attended events.</p>}
          </div>
        </section>

        <section>
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
              />
            ))}
            {upcomingEvents.length === 0 && <p className="text-sm text-text/80">No upcoming events.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Recent Reviews and Comments ({userReviews.length})</h2>
          <div className="space-y-3">
            {userReviews.slice(0, 10).map((review) => (
              <div key={review.id} className="bg-surface rounded-lg p-4 border border-text/10">
                <p className="text-sm text-text/80">Event #{review.event_title}</p>
                {review.rating !== null && review.rating !== undefined && (
                  <p className="font-medium">Rating: {review.rating}/5</p>
                )}
                {review.comment && <p>{review.comment}</p>}
                <p className="text-xs text-text/70 mt-2">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>
            ))}
            {userReviews.length === 0 && <p className="text-sm text-text/80">No recent reviews or comments.</p>}
          </div>
        </section>
      </div>

      {modalConfig && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6"
          onClick={() => setActiveFollowModal(null)}
        >
          <div
            className="w-full max-w-4xl rounded-xl border border-text/10 bg-surface p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modalConfig.title}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-2xl font-semibold text-text">{modalConfig.title}</h3>
              <button
                type="button"
                onClick={() => setActiveFollowModal(null)}
                className="rounded-md border border-text/10 px-3 py-1 text-sm text-text transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto pr-2">
              {modalConfig.content.length > 0 ? (
                <div className="space-y-3">{modalConfig.content}</div>
              ) : (
                <p className="text-sm text-text/80">{modalConfig.emptyText}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
