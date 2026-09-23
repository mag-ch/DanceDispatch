import { getVenues } from '@/lib/utils_supabase_server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        const { venueId } = await params;
        const venues = await getVenues();
        const venue = venues.find(v => v.id === venueId);        
        if (!venue) {
            return new Response(JSON.stringify({ error: 'Venue not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(venue), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch venue' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ venueId: string }> }
) {
    try {
        await requireAdmin();
        const { venueId } = await params;
        const body = await request.json();
        const { name, bio, address, type, photoUrl, website, freeformAttributes, starAttributes, deletedAttributeIds } = body;

        const updates: Record<string, unknown> = {};
        if (typeof name === 'string') updates.name = name.trim();
        if (typeof bio === 'string') updates.bio = bio.trim();
        if (typeof address === 'string') updates.address = address.trim();
        if (typeof type === 'string') updates.type = type.trim();
        if (typeof website === 'string') updates.external_url = website.trim();
        if (typeof photoUrl === 'string') updates.image_url = photoUrl.trim();

        const freeformRows = Array.isArray(freeformAttributes)
            ? freeformAttributes
                .filter((item): item is { attribute: string; value: string } => (
                    typeof item?.attribute === 'string' && typeof item?.value === 'string'
                ))
                .map((item) => ({
                    venue_id: venueId,
                    attribute: item.attribute.trim(),
                    value: item.value.trim(),
                    data_type: 'unique',
                }))
                .filter((item) => item.attribute && item.value)
            : [];

        const starRows = Array.isArray(starAttributes)
            ? starAttributes
                .filter((item): item is { attribute: string; value: number } => (
                    typeof item?.attribute === 'string' && typeof item?.value === 'number'
                ))
                .map((item) => ({
                    venue_id: venueId,
                    attribute: item.attribute.trim(),
                    value: item.value,
                    data_type: 'rating',
                }))
                .filter((item) => item.attribute && Number.isInteger(item.value) && item.value >= 1 && item.value <= 5)
            : [];

        const attributeUpdates = [...freeformAttributes ?? [], ...starAttributes ?? []]
            .filter((item): item is { id: number; attribute: string; value: string | number } => (
                Number.isInteger(item?.id) && typeof item?.attribute === 'string' && (
                    typeof item?.value === 'string' || typeof item?.value === 'number'
                )
            ))
            .map((item) => ({
                id: item.id,
                attribute: item.attribute.trim(),
                value: item.value,
            }))
            .filter((item) => item.attribute && (
                typeof item.value === 'string'
                    ? item.value.trim()
                    : Number.isInteger(item.value) && item.value >= 1 && item.value <= 5
            ));

        const attributeIdsToDelete = Array.isArray(deletedAttributeIds)
            ? deletedAttributeIds.filter((id): id is number => Number.isInteger(id))
            : [];

        if (Object.keys(updates).length === 0 && freeformRows.length === 0 && starRows.length === 0 && attributeUpdates.length === 0 && attributeIdsToDelete.length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = await createClient();
        if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('Venues').update(updates).eq('id', venueId);
            if (error) {
                console.error('Error updating venue:', error);
                return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 });
            }
        }

        const attributeRows = [...freeformRows, ...starRows];
        if (attributeRows.length > 0) {
            const { error } = await supabase.from('venue_attributes').insert(attributeRows);
            if (error) {
                console.error('Error adding venue attributes:', error);
                return NextResponse.json({ error: 'Failed to add venue attributes' }, { status: 500 });
            }
        }

        for (const item of attributeUpdates) {
            const { error } = await supabase
                .from('venue_attributes')
                .update({ attribute: item.attribute, value: item.value })
                .eq('id', item.id)
                .eq('venue_id', venueId);
            if (error) {
                console.error('Error updating venue attribute:', error);
                return NextResponse.json({ error: 'Failed to update venue attribute' }, { status: 500 });
            }
        }

        if (attributeIdsToDelete.length > 0) {
            const { error } = await supabase
                .from('venue_attributes')
                .delete()
                .in('id', attributeIdsToDelete)
                .eq('venue_id', venueId);
            if (error) {
                console.error('Error deleting venue attributes:', error);
                return NextResponse.json({ error: 'Failed to delete venue attributes' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update venue';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}