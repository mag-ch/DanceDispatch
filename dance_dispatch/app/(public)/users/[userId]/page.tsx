import { getUserById, getUserReviews } from "@/lib/utils_supabase_server";
import { getAllFollowedHosts, getAllFollowedUsers, getAllFollowedVenues } from "@/lib/utils_supabase_server";
import { getSavedEventsForUserServer } from "@/lib/server_utils";
import UserProfileClient from "./UserProfileClient";
import type { Metadata } from 'next';
import { cache } from 'react';
import { pageMetadata } from '@/lib/page-metadata';
import { getCurrentUser } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

const getProfile = cache(getUserById);

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const user = await getProfile(userId);
  if (!user?.id) return { title: 'User not found' };

  const name = typeof user.username === 'string' && user.username.trim() ? user.username.trim() : 'User';
  const image = typeof user.profile_picture === 'string' && user.profile_picture.trim()
    ? user.profile_picture.trim()
    : '/images/default_users.jpg';
  return pageMetadata(name, `Explore ${name}'s profile on DanceDispatch.`, `/users/${encodeURIComponent(String(user.id))}`, image);
}

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await getProfile(userId);
  if (!user?.id) return <div className="min-h-screen bg-bg text-text p-6">User not found.</div>;

  const viewer = await getCurrentUser();
  let canSeeActivity = viewer?.id === userId;
  let isBlocked = false;
  if (viewer && !canSeeActivity) {
    const supabase = await createClient();
    const [{ data, error }, blockResult] = await Promise.all([supabase
      .from('UserFollowUsers')
      .select('user_id')
      .eq('user_id', viewer.id)
      .eq('followed_id', userId)
      .maybeSingle(), supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', viewer.id)
      .eq('blocked_id', userId)
      .maybeSingle()]);
    if (error) throw error;
    if (blockResult.error) throw blockResult.error;
    isBlocked = Boolean(blockResult.data);
    canSeeActivity = Boolean(data);
  }

  const [followedVenues, followedHosts, followedUsers, upcomingEvents, pastEvents, userReviews] = await Promise.all([
    getAllFollowedVenues(userId).catch(() => []),
    getAllFollowedHosts(userId).catch(() => []),
    getAllFollowedUsers(userId).catch(() => []),
    canSeeActivity ? getSavedEventsForUserServer(userId, "upcoming") : Promise.resolve([]),
    getSavedEventsForUserServer(userId, "past").catch(() => []),
    canSeeActivity ? getUserReviews(user.id, viewer?.id === userId) : Promise.resolve([]),
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
      canSeeActivity={canSeeActivity}
      isOwnProfile={viewer?.id === userId}
      canManageBlock={Boolean(viewer) && viewer?.id !== userId}
      isBlocked={isBlocked}
    />
  );
}
