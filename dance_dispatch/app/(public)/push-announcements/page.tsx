import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { PUSH_TEST_USER_ID } from '@/lib/push-notification-constants';
import { getEvents } from '@/lib/utils_supabase_server';
import PushAnnouncementsClient from './PushAnnouncementsClient';

export default async function PushAnnouncementsPage() {
  const user = await requireAuth();
  if (user.id !== PUSH_TEST_USER_ID) redirect('/');

  const events = await getEvents(false);
  return <PushAnnouncementsClient events={events.map(({ id, title, startdate, location }) => ({ id, title, startdate, location }))} />;
}