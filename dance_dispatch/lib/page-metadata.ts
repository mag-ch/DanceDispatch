import type { Metadata } from 'next';

export function metadataDescription(value: string | null | undefined, fallback: string): string {
  return value?.replace(/\s+/g, ' ').trim().slice(0, 160) || fallback;
}

export function pageMetadata(title: string, description: string, url: string, image: string): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'DanceDispatch',
      type: 'website',
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
