import type { SupabaseClient } from '@supabase/supabase-js';

export async function getOrganizerEventIds(supabase: SupabaseClient, hostId: string): Promise<number[]> {
    const { data: host, error: hostError } = await supabase
        .from('Hosts').select('host_type').eq('id', hostId).maybeSingle();
    if (hostError) throw hostError;
    if (host?.host_type !== 'Organizer') return [];

    const eventIds = new Set<number>();
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from('event_hosts')
            .select('event_id').eq('host_id', hostId).order('event_id').range(offset, offset + pageSize - 1);
        if (error) throw error;
        for (const link of data ?? []) eventIds.add(link.event_id);
        if ((data?.length ?? 0) < pageSize) break;
    }

    const seriesIds: number[] = [];
    for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from('EventSeries')
            .select('id').eq('host_id', hostId).order('id').range(offset, offset + pageSize - 1);
        if (error) throw error;
        seriesIds.push(...(data ?? []).map((item) => item.id));
        if ((data?.length ?? 0) < pageSize) break;
    }
    for (let offset = 0; offset < seriesIds.length; offset += 200) {
        for (let page = 0; ; page += pageSize) {
            const { data, error } = await supabase.from('Events')
                .select('id').in('series_id', seriesIds.slice(offset, offset + 200))
                .order('id').range(page, page + pageSize - 1);
            if (error) throw error;
            for (const event of data ?? []) eventIds.add(event.id);
            if ((data?.length ?? 0) < pageSize) break;
        }
    }
    return [...eventIds];
}
