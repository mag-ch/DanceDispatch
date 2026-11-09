import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getHostById } from '@/lib/utils_supabase_server';
import { metadataDescription, pageMetadata } from '@/lib/page-metadata';

type HostLayoutProps = {
  children: ReactNode;
  params: Promise<{ hostId: string }>;
};

export async function generateMetadata({ params }: HostLayoutProps): Promise<Metadata> {
  const { hostId } = await params;
  const host = await getHostById(hostId);
  if (!host) return { title: 'Host not found' };

  const description = metadataDescription(host.bio, `Discover events and reviews for ${host.name} on DanceDispatch.`);
  return pageMetadata(host.name, description, `/hosts/${encodeURIComponent(host.id)}`, host.photoUrl?.trim() || '/images/default_hosts.jpg');
}

export default function HostLayout({ children }: HostLayoutProps) {
  return children;
}
