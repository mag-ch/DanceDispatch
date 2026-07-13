import { getCachedEvents } from '@/lib/utils_supabase_server';
import { LandingAnnouncementModalClient, type LandingAnnouncementEvent } from '@/app/components/LandingAnnouncementModalClient';

type LandingAnnouncement = {
  announcementId: string;
  header: string;
  events: LandingAnnouncementEvent[];
};

const ANNOUNCEMENT_ID = 'weekend-parties-july-10-12-2026';
const ANNOUNCEMENT_HEADER = 'Did you attend any of these parties this weekend? Leave a review!';
const ANNOUNCEMENT_RANGE_START = '2026-07-10';
const ANNOUNCEMENT_RANGE_END = '2026-07-12';

function getOrdinalDay(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function toDayHeading(startdate: string): string {
  const [year, month, day] = startdate.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return startdate;
  }

  const monthName = new Date(Date.UTC(year, month - 1, day)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });

  return `${monthName} ${getOrdinalDay(day)}`;
}

export async function LandingAnnouncementModal() {
  const events: LandingAnnouncementEvent[] = (await getCachedEvents(false))
    .filter((event) => event.startdate >= ANNOUNCEMENT_RANGE_START && event.startdate <= ANNOUNCEMENT_RANGE_END)
    .sort((a, b) => {
      const aTime = new Date(`${a.startdate} ${a.starttime}`).getTime();
      const bTime = new Date(`${b.startdate} ${b.starttime}`).getTime();
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    })
    .map((event) => ({
      id: String(event.id),
      title: event.title,
      subtitle: event.location || 'Unknown Venue',
      dayHeading: toDayHeading(event.startdate),
      href: `/events/${event.id}?showReviewModal=true`,
    }));

  const announcements: LandingAnnouncement[] = [
    {
      announcementId: ANNOUNCEMENT_ID,
      header: ANNOUNCEMENT_HEADER,
      events,
    },
  ];

  const sampleSecondAnnouncement: LandingAnnouncement = {
    announcementId: 'sample-announcement-new-features-2026-07-05',
    header: 'New this week: profile notification controls and leaderboard updates',
    events: (await getCachedEvents())
      .slice(0, 3)
      .map((event) => ({
        id: String(event.id),
        title: event.title,
        subtitle: event.location || 'Unknown Venue',
        dayHeading: toDayHeading(event.startdate),
        href: `/events/${event.id}`,
      })),
  };

  // announcements.push(sampleSecondAnnouncement);

  const activeAnnouncement = announcements[0];

  if (!activeAnnouncement) {
    return null;
  }

  return (
    <LandingAnnouncementModalClient
      announcementId={activeAnnouncement.announcementId}
      header={activeAnnouncement.header}
      events={activeAnnouncement.events}
    />
  );
}
