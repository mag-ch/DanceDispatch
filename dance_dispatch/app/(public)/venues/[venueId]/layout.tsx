import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { metadataDescription, pageMetadata } from '@/lib/page-metadata';
import { getVenueById } from '@/lib/utils_supabase_server';

type VenueLayoutProps = {
  children: ReactNode;
  params: Promise<{ venueId: string }>;
};

export async function generateMetadata({ params }: VenueLayoutProps): Promise<Metadata> {
  const { venueId } = await params;
  const venue = await getVenueById(venueId);
  if (!venue) return { title: 'Venue not found' };

  const description = metadataDescription(venue.bio, `Discover events and reviews for ${venue.name} on DanceDispatch.`);
  return pageMetadata(venue.name, description, `/venues/${encodeURIComponent(venue.id)}`, venue.photourls?.[0]?.trim() || '/images/default_venues.jpg');
}

export default function VenueLayout({ children }: VenueLayoutProps) {
  return children;
}
