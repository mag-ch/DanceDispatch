'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Venue } from '@/lib/utils';
import { useAuth } from '@/app/providers/AuthContext';

interface VenueDetailsEditorProps {
    venue: Venue;
}

export default function VenueDetailsEditor({ venue }: VenueDetailsEditorProps) {
    const { isAdmin } = useAuth();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(venue.name ?? '');
    const [type, setType] = useState(venue.type ?? '');
    const [bio, setBio] = useState(venue.bio ?? '');
    const [address, setAddress] = useState(venue.address ?? '');
    const [website, setWebsite] = useState(venue.website ?? '');
    const [photoUrl, setPhotoUrl] = useState(venue.photourls ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isAdmin) {
        return null;
    }

    const startEditing = () => {
        setName(venue.name ?? '');
        setType(venue.type ?? '');
        setBio(venue.bio ?? '');
        setAddress(venue.address ?? '');
        setWebsite(venue.website ?? '');
        setPhotoUrl(venue.photourls ?? '');
        setError(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setError(null);
    };

    const saveEdits = async () => {
        setSaving(true);
        setError(null);

        try {
            const response = await fetch(`/api/venues/${encodeURIComponent(venue.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, bio, address, website, photoUrl }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error ?? 'Failed to save venue details');
            }

            window.location.reload();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save venue details');
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-semibold text-text transition hover:border-accent"
            >
                <Pencil className="h-4 w-4" />
                Edit Details
            </button>
        );
    }

    return (
        <div className="w-full rounded-lg border border-default bg-bg p-4">
            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Venue name</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} className="rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Type</span>
                    <input value={type} onChange={(event) => setType(event.target.value)} className="rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-sm font-semibold text-text">Address</span>
                    <input value={address} onChange={(event) => setAddress(event.target.value)} className="rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-sm font-semibold text-text">Bio</span>
                    <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} className="rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Website</span>
                    <input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} className="rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Photo URL</span>
                    <input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} className="rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-4 flex items-center justify-end gap-2">
                <button type="button" onClick={cancelEditing} disabled={saving} className="inline-flex items-center gap-2 rounded border border-default px-3 py-2 text-sm font-semibold text-text transition hover:border-accent disabled:opacity-60">
                    <X className="h-4 w-4" />
                    Cancel
                </button>
                <button type="button" onClick={() => void saveEdits()} disabled={saving} className="inline-flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-semibold text-text transition hover:bg-accent-soft disabled:opacity-60">
                    <Check className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}
