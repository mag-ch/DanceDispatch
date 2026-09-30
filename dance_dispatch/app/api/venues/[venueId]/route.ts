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

        // New freeform attributes: only items WITHOUT an id
        const freeformRows = Array.isArray(freeformAttributes)
            ? freeformAttributes
                .filter((item): item is { attribute: string; value: string } => (
                    item?.id == null &&
                    typeof item?.attribute === 'string' && typeof item?.value === 'string'
                ))
                .map((item) => ({
                    venue_id: venueId,
                    attribute: item.attribute.trim(),
                    value: item.value.trim() as string | number,
                    data_type: 'unique',
                }))
                .filter((item) => item.attribute && item.value)
            : [];

        // New star ratings: only items WITHOUT an id
        const starRows = Array.isArray(starAttributes)
            ? starAttributes
                .filter((item): item is { attribute: string; value: number } => (
                    item?.id == null &&
                    typeof item?.attribute === 'string' && typeof item?.value === 'number'
                ))
                .map((item) => ({
                    venue_id: venueId,
                    attribute: item.attribute.trim(),
                    value: item.value as string | number,
                    data_type: 'rating',
                }))
                .filter((item) => item.attribute && Number.isInteger(item.value) && (item.value as number) >= 1 && (item.value as number) <= 5)
            : [];

        // Existing attributes (items WITH an id)
        const attributeUpdates = [
            ...(Array.isArray(freeformAttributes) ? freeformAttributes : []),
            ...(Array.isArray(starAttributes) ? starAttributes : []),
        ]
            .filter((item): item is { id: number; attribute: string; value: string | number } => (
                Number.isInteger(item?.id) && typeof item?.attribute === 'string' && (
                    typeof item?.value === 'string' || typeof item?.value === 'number'
                )
            ))
            .map((item) => ({
                id: item.id,
                attribute: item.attribute.trim(),
                value: typeof item.value === 'string' ? item.value.trim() : item.value,
            }))
            .filter((item) => item.attribute && (
                typeof item.value === 'string'
                    ? item.value
                    : Number.isInteger(item.value) && item.value >= 1 && item.value <= 5
            ));

        const attributeIdsToDelete = Array.isArray(deletedAttributeIds)
            ? deletedAttributeIds.filter((id): id is number => Number.isInteger(id))
            : [];

        const newRows = [...freeformRows, ...starRows];

        if (
            Object.keys(updates).length === 0 &&
            newRows.length === 0 &&
            attributeUpdates.length === 0 &&
            attributeIdsToDelete.length === 0
        ) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Venue fields
        if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('Venues').update(updates).eq('id', venueId);
            if (error) {
                console.error('Error updating venue:', error);
                return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 });
            }
        }

        // 2. New attributes: if one already exists (same type + name), update it instead of inserting a duplicate
        if (newRows.length > 0) {
            const { data: existing, error: lookupError } = await supabase
                .from('venue_attributes')
                .select('id, attribute, data_type')
                .eq('venue_id', venueId);
            if (lookupError) {
                console.error('Error looking up venue attributes:', lookupError);
                return NextResponse.json({ error: 'Failed to check existing venue attributes' }, { status: 500 });
            }

            const keyOf = (dataType: string, attribute: string) => `${dataType}:${attribute.toLowerCase()}`;
            const existingIds = new Map(
                (existing ?? []).map((row) => [keyOf(row.data_type, row.attribute), row.id as number])
            );

            const rowsToInsert: typeof newRows = [];
            for (const row of newRows) {
                const existingId = existingIds.get(keyOf(row.data_type, row.attribute));
                if (existingId !== undefined) {
                    attributeUpdates.push({ id: existingId, attribute: row.attribute, value: row.value });
                } else {
                    rowsToInsert.push(row);
                }
            }

            if (rowsToInsert.length > 0) {
                const { error } = await supabase.from('venue_attributes').insert(rowsToInsert);
                if (error) {
                    console.error('Error adding venue attributes:', error);
                    return NextResponse.json({ error: 'Failed to add venue attributes' }, { status: 500 });
                }
            }
        }

        // 3. Update existing attributes (including matches found above)
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

        // 4. Deletes
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