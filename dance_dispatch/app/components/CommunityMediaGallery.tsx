'use client';
import { createClient } from '@/lib/supabase/client';

export interface CommunityMediaItem {
    path: string;
    eventId?: string | number;
    eventName?: string;
}

/** Photos/videos fans attached to reviews of a venue or DJ, shown on that entity's page. */
export default function CommunityMediaGallery({ items }: { items: CommunityMediaItem[] }) {
    const supabase = createClient();
    const unique = Array.from(new Map(items.map((item) => [item.path, item])).values());
    if (unique.length === 0) return null;

    return (
        <section className="mb-6 bg-surface p-6 rounded-lg">
            <h2 className="font-semibold text-text text-lg mb-4">Community Photos &amp; Videos</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
                {unique.map((item) => {
                    const { data } = supabase.storage.from('event-media').getPublicUrl(item.path);
                    const isVideo = /\.(mp4|mov|webm)$/i.test(item.path);
                    return (
                        <figure key={item.path} className="w-44 shrink-0">
                            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                                {isVideo ? (
                                    <video src={data.publicUrl} className="h-full w-full object-cover" controls playsInline preload="metadata" />
                                ) : (
                                    <img src={data.publicUrl} alt={item.eventName ?? 'Community media'} className="h-full w-full object-cover" loading="lazy" />
                                )}
                            </div>
                            {item.eventName && item.eventId && (
                                <figcaption className="mt-1 truncate text-xs text-muted">
                                    <a href={`/events/${item.eventId}`} className="hover:underline">{item.eventName}</a>
                                </figcaption>
                            )}
                        </figure>
                    );
                })}
            </div>
        </section>
    );
}
