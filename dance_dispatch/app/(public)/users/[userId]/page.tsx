import { getUserById } from "@/lib/utils_supabase_server";
import { getAllFollowedHosts, getAllFollowedUsers, getAllFollowedVenues } from "@/lib/utils_supabase_server";
import { getSavedEventsForUserServer, getUserReviews } from "@/lib/server_utils";
import UserProfileClient from "./UserProfileClient";

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await getUserById(userId);

  const [followedVenues, followedHosts, followedUsers, upcomingEvents, pastEvents, userReviews] = await Promise.all([
    getAllFollowedVenues(userId).catch(() => []),
    getAllFollowedHosts(userId).catch(() => []),
    getAllFollowedUsers(userId).catch(() => []),
    getSavedEventsForUserServer(userId, "upcoming").catch(() => []),
    getSavedEventsForUserServer(userId, "past").catch(() => []),
    getUserReviews(userId).catch(() => []),
  ]);

  return (
    <UserProfileClient
      user={user}
      followedVenues={followedVenues}
      followedHosts={followedHosts}
      followedUsers={followedUsers}
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
      userReviews={userReviews}
    />
  );
}

