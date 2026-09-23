'use client';

import { useState } from 'react';
import { Pencil, Check, X, Star, Plus, Trash2 } from 'lucide-react';
import { Venue } from '@/lib/utils';
import { useAuth } from '@/app/providers/AuthContext';

interface VenueDetailsEditorProps {
    venue: Venue;
    attributes: VenueAttribute[];
}

interface VenueAttribute {
    id: number;
    attribute: string;
    value: string | number;
    data_type: 'unique' | 'rating';
}

interface EditableAttribute {
    id?: number;
    attribute: string;
    value: string | number;
}

export default function VenueDetailsEditor({ venue, attributes }: VenueDetailsEditorProps) {
    const { isAdmin } = useAuth();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(venue.name ?? '');
    const [type, setType] = useState(venue.type ?? '');
    const [bio, setBio] = useState(venue.bio ?? '');
    const [address, setAddress] = useState(venue.address ?? '');
    const [website, setWebsite] = useState(venue.website ?? '');
    const [photoUrl, setPhotoUrl] = useState(venue.photourls ?? '');
    const [freeformAttributes, setFreeformAttributes] = useState<EditableAttribute[]>([]);
    const [starAttributes, setStarAttributes] = useState<EditableAttribute[]>([]);
    const [deletedAttributeIds, setDeletedAttributeIds] = useState<number[]>([]);
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
        setFreeformAttributes(attributes.filter((item) => item.data_type === 'unique').map((item) => ({ id: item.id, attribute: item.attribute, value: String(item.value) })));
        setStarAttributes(attributes.filter((item) => item.data_type === 'rating').map((item) => ({ id: item.id, attribute: item.attribute, value: Number(item.value) })));
        setDeletedAttributeIds([]);
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
                body: JSON.stringify({ name, type, bio, address, website, photoUrl, freeformAttributes, starAttributes, deletedAttributeIds }),
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

    const addFreeformAttribute = () => {
        setFreeformAttributes((attributes) => [...attributes, { attribute: '', value: '' }]);
    };

    const addStarAttribute = () => {
        setStarAttributes((attributes) => [...attributes, { attribute: '', value: 0 }]);
    };

    const removeAttribute = (items: EditableAttribute[], index: number, setItems: (items: EditableAttribute[]) => void) => {
        const removed = items[index];
        if (removed.id !== undefined) {
            setDeletedAttributeIds((ids) => [...ids, removed.id as number]);
        }
        setItems(items.filter((_, currentIndex) => currentIndex !== index));
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
        <div className="w-full min-w-0 rounded-lg border border-default bg-bg p-3 sm:p-4">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Venue name</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Type</span>
                    <input value={type} onChange={(event) => setType(event.target.value)} className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 md:col-span-2">
                    <span className="text-sm font-semibold text-text">Address</span>
                    <input value={address} onChange={(event) => setAddress(event.target.value)} className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 md:col-span-2">
                    <span className="text-sm font-semibold text-text">Bio</span>
                    <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} className="w-full min-w-0 resize-y rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Website</span>
                    <input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-semibold text-text">Photo URL</span>
                    <input type="url" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text" />
                </label>
            </div>

            <div className="mt-5 border-t border-default pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-text">Freeform attributes</h3>
                    <button type="button" onClick={addFreeformAttribute} className="inline-flex items-center gap-1 rounded border border-default px-2 py-1 text-sm font-semibold text-text transition hover:border-accent">
                        <Plus className="h-4 w-4" />
                        Add attribute
                    </button>
                </div>
                <div className="mt-3 grid gap-3">
                    {freeformAttributes.map((item, index) => (
                        <div key={`freeform-${index}`} className="flex min-w-0 flex-col gap-2 sm:flex-row">
                            <input value={item.attribute} onChange={(event) => setFreeformAttributes((attributes) => attributes.map((current, currentIndex) => currentIndex === index ? { ...current, attribute: event.target.value } : current))} placeholder="Attribute name" className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text sm:flex-1" />
                            <input value={item.value} onChange={(event) => setFreeformAttributes((attributes) => attributes.map((current, currentIndex) => currentIndex === index ? { ...current, value: event.target.value } : current))} placeholder="Value" className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text sm:flex-1" />
                            <button type="button" onClick={() => removeAttribute(freeformAttributes, index, setFreeformAttributes)} aria-label="Remove freeform attribute" className="inline-flex w-full items-center justify-center rounded border border-default px-3 py-2 text-text transition hover:border-accent sm:w-auto">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-5 border-t border-default pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-text">Star attributes</h3>
                    <button type="button" onClick={addStarAttribute} className="inline-flex items-center gap-1 rounded border border-default px-2 py-1 text-sm font-semibold text-text transition hover:border-accent">
                        <Plus className="h-4 w-4" />
                        Add rating
                    </button>
                </div>
                <div className="mt-3 grid gap-3">
                    {starAttributes.map((item, index) => (
                        <div key={`star-${index}`} className="flex min-w-0 flex-col gap-2 rounded border border-default p-3 sm:flex-row sm:items-center">
                            <input value={item.attribute} onChange={(event) => setStarAttributes((attributes) => attributes.map((current, currentIndex) => currentIndex === index ? { ...current, attribute: event.target.value } : current))} placeholder="Rating name" className="w-full min-w-0 rounded border border-default bg-surface px-3 py-2 text-text sm:flex-1" />
                            <div className="flex items-center justify-between gap-1" aria-label={`${item.value} out of 5 stars`}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button key={star} type="button" onClick={() => setStarAttributes((attributes) => attributes.map((current, currentIndex) => currentIndex === index ? { ...current, value: star } : current))} aria-label={`${star} stars`} className="p-1 text-text transition hover:text-accent">
                                        <Star className="h-5 w-5" fill={star <= Number(item.value) ? 'currentColor' : 'none'} />
                                    </button>
                                ))}
                            </div>
                            <button type="button" onClick={() => removeAttribute(starAttributes, index, setStarAttributes)} aria-label="Remove star attribute" className="inline-flex w-full items-center justify-center rounded border border-default px-3 py-2 text-text transition hover:border-accent sm:w-auto">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={cancelEditing} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded border border-default px-3 py-2 text-sm font-semibold text-text transition hover:border-accent disabled:opacity-60 sm:w-auto">
                    <X className="h-4 w-4" />
                    Cancel
                </button>
                <button type="button" onClick={() => void saveEdits()} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded bg-accent px-3 py-2 text-sm font-semibold text-text transition hover:bg-accent-soft disabled:opacity-60 sm:w-auto">
                    <Check className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}
