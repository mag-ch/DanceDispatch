'use client';

import { use, useEffect, useState } from 'react';
import { Calendar, Star, Pencil, Check, X, Plus, Trash2 } from 'lucide-react';
import { SearchResult } from '@/app/components/EventCard';
import Link from 'next/link';
import VenueImageGallery from './VenueImageGallery';
import { FollowEntityButton } from '@/app/components/SaveEventButton';
import OpenInMapsButton from '@/app/components/OpenInMapsButton';
import { renderDescriptionWithLineBreaks } from '@/app/components/Components';
import { isUpcoming } from '@/lib/date-utils';
import CommunityMediaGallery from '@/app/components/CommunityMediaGallery';
import { useAuth } from '@/app/providers/AuthContext';
import type { Event, Venue } from '@/lib/utils';

interface EditableAttribute {
    id?: number;
    attribute: string;
    value: string | number;
}

interface VenuePageData {
    venue: Venue;
    venues: Venue[];
    allEvents: Event[];
    uniqueVenueAttributes: { attribute: string; value: string | number }[] | null;
    aggregatedVenueAttributes: { attribute: string; average: number }[] | null;
    venueAttributes: (EditableAttribute & { id: number; data_type: 'unique' | 'rating' })[];
    venueComments: VenueComment[] | null;
    venueCoordinates: { lat: number; lng: number } | null;
}

interface VenueComment {
    rating: number | string | null;
    comment: string | null;
    created_at: string;
    event_id: string | number;
    username: string;
    eventName: string;
    mediaPaths: string[];
}

export const VENUE_TYPES = ['Nightclub', 'Indoor Space', 'Outdoor', 'Studio', 'Bar', 'Community Center', 'Live Music Venue', 'Restaurant', 'Record Store', 'Cafe'] as const;

function prettifyAttribute(attribute: string) {
    const readable = attribute.replace(/_/g, ' ');
    return readable.slice(0, 1).toUpperCase() + readable.slice(1);
}

export default function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
    const { venueId } = use(params);
    const { session, isAdmin } = useAuth();
    const isAuthenticated = !!session && isAdmin;
    const [pageData, setPageData] = useState<VenuePageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [bio, setBio] = useState('');
    const [address, setAddress] = useState('');
    const [website, setWebsite] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [freeformAttributes, setFreeformAttributes] = useState<EditableAttribute[]>([]);
    const [starAttributes, setStarAttributes] = useState<EditableAttribute[]>([]);
    const [deletedAttributeIds, setDeletedAttributeIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchVenueDetails = async () => {
            try {
                const response = await fetch(`/api/venues/${encodeURIComponent(venueId)}/details`);
                const data = await response.json();
                if (!response.ok) throw new Error(data.error ?? 'Failed to fetch venue details');
                if (!cancelled) setPageData(data);
            } catch (fetchError) {
                if (!cancelled) setLoadError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch venue details');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void fetchVenueDetails();
        return () => { cancelled = true; };
    }, [venueId]);

    const startEditing = () => {
        if (!pageData) return;
        const venue = pageData.venue;
        setName(venue.name ?? '');
        setType(venue.type ?? '');
        setBio(venue.bio ?? '');
        setAddress(venue.address ?? '');
        setWebsite(venue.website ?? '');
        setPhotoUrl(venue.photourls ?? '');
        setFreeformAttributes(pageData.venueAttributes.filter((item) => item.data_type === 'unique').map((item) => ({ id: item.id, attribute: item.attribute, value: String(item.value) })));
        setStarAttributes(pageData.venueAttributes.filter((item) => item.data_type === 'rating').map((item) => ({ id: item.id, attribute: item.attribute, value: Number(item.value) })));
        setDeletedAttributeIds([]);
        setError(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setError(null);
    };

    const saveEdits = async () => {
        if (!pageData) return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/venues/${encodeURIComponent(pageData.venue.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, bio, address, website, photoUrl, freeformAttributes, starAttributes, deletedAttributeIds }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.error ?? 'Failed to save venue details');
            window.location.reload();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save venue details');
            setSaving(false);
        }
    };

    const addFreeformAttribute = () => setFreeformAttributes((attributes) => [...attributes, { attribute: '', value: '' }]);
    const addStarAttribute = () => setStarAttributes((attributes) => [...attributes, { attribute: '', value: 0 }]);
    const removeAttribute = (items: EditableAttribute[], index: number, setItems: (items: EditableAttribute[]) => void) => {
        const removed = items[index];
        if (removed.id !== undefined) setDeletedAttributeIds((ids) => [...ids, removed.id!]);
        setItems(items.filter((_, currentIndex) => currentIndex !== index));
    };

    if (loading) return <p className="p-8 text-text">Loading venue...</p>;
    if (loadError || !pageData) return <p role="alert" className="p-8 text-red-500">{loadError ?? 'Venue not found.'}</p>;

    const { venue, venues, allEvents, uniqueVenueAttributes, aggregatedVenueAttributes, venueComments, venueCoordinates } = pageData;
    const ratedComments = (venueComments ?? []).filter((comment) => Number(comment.rating) > 0);
    const ratingCount = ratedComments.length;
    const averageRating = ratingCount > 0
        ? ratedComments.reduce((sum, comment) => sum + Number(comment.rating), 0) / ratingCount
        : 0;
    const textComments = (venueComments ?? [])
        .filter((comment) => Boolean(comment.comment?.trim()))
        .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
        .slice(0, 5);

    const now = new Date();
    const pastEvents = allEvents
        .filter(event => !isUpcoming(event, now))
        .sort((a, b) => new Date(`${b.startdate} ${b.starttime}`).getTime() - new Date(`${a.startdate} ${a.starttime}`).getTime())
        .slice(0, 5);
    const upcomingEvents = allEvents.filter(event => isUpcoming(event, now));
    const similarVenues = venues.filter(v => v.type === venue.type && v.id !== venueId).slice(0, 5);

    return (
        <div className="min-h-screen bg-bg text-text">
            {/* Image Gallery */}
            {<VenueImageGallery photourls={venue.photourls} venueName={venue.name} />}

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Header */}
                        <section className="mb-4 bg-surface p-6 rounded-lg">
                            <div className="flex flex-col gap-4 mb-2 md:flex-row md:items-start md:justify-between">
                                <div className="flex w-full min-w-0 flex-1 flex-col items-start gap-2">
                                    {editing ? (
                                        <>
                                            <label className="w-full text-sm text-muted">Venue type
                                                <select className="mt-1 w-full rounded border border-default bg-bg p-2 text-text" value={type} onChange={(event) => setType(event.target.value)}>
                                                    {VENUE_TYPES.map((venueType) => <option key={venueType} value={venueType}>{venueType}</option>)}
                                                </select>
                                            </label>
                                            <input aria-label="Venue name" className="w-full rounded border border-default bg-bg p-2 text-4xl font-bold text-text" value={name} onChange={(event) => setName(event.target.value)} />
                                            <label className="w-full text-sm text-muted">Photo URL
                                                <input className="mt-1 w-full rounded border border-default bg-bg p-2 text-text" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} />
                                            </label>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="text-sm uppercase text-text">{venue.type}</h2>
                                            <h1 className="break-words text-4xl font-bold text-text">{venue.name}</h1>
                                        </>
                                    )}
                                </div>
                                <div className="flex w-full min-w-0 flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
                                    <FollowEntityButton entity="venues" entityId={venue.id} />
                                    {isAuthenticated && !editing && (
                                        <button type="button" onClick={startEditing} className="self-start rounded border border-default p-2 transition hover:border-accent" title="Edit">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                    )}
                                    {editing && (
                                        <>
                                            <button type="button" onClick={saveEdits} disabled={saving} className="rounded border border-green-500 p-2 text-green-500 transition hover:bg-green-500 hover:text-white disabled:opacity-50" title="Save">
                                                <Check className="h-4 w-4" />
                                            </button>
                                            <button type="button" onClick={cancelEditing} disabled={saving} className="rounded border border-red-500 p-2 text-red-500 transition hover:bg-red-500 hover:text-white" title="Cancel">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
                        </section>
                        {/* External Link */}
                        {(venue.website || editing) && (
                            <section className="mb-4 bg-surface p-6 rounded-lg">
                                {editing ? (
                                    <label className="block text-sm font-semibold text-text">Website
                                        <input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} className="mt-2 w-full rounded border border-default bg-bg p-2 font-normal text-text" />
                                    </label>
                                ) : (
                                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-blue-500 transition hover:text-blue-600">
                                        Visit Website <span>↗</span>
                                    </a>
                                )}
                            </section>
                        )}

                        {/* Bio */}
                        {(venue.bio || editing) && <section className="mb-4 bg-surface p-6 rounded-lg">
                            <h2 className="font-semibold text-text text-lg mb-2">Bio</h2>
                            {editing ? (
                                <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} className="w-full resize-y rounded border border-default bg-bg p-2 text-text" />
                            ) : (
                                <p className="text-text">{renderDescriptionWithLineBreaks(venue.bio)}</p>
                            )}
                        </section>}



                        {/* Address & Map */}
                        <section className="mb-4 bg-surface p-6 rounded-lg">
                            {editing ? (
                                <label className="mb-3 block text-sm font-semibold text-text">Address
                                    <input value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 w-full rounded border border-default bg-bg p-2 font-normal text-text" />
                                </label>
                            ) : (
                                <OpenInMapsButton address={venue.address} />
                            )}
                            {venueCoordinates ? (
                                <iframe
                                    width="100%"
                                    height="300"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${venueCoordinates.lng - 0.005}%2C${venueCoordinates.lat - 0.005}%2C${venueCoordinates.lng + 0.005}%2C${venueCoordinates.lat + 0.005}&layer=mapnik&marker=${venueCoordinates.lat}%2C${venueCoordinates.lng}`}
                                    className="rounded"
                                    loading="lazy"
                                />
                            ) : (
                                <p className="text-sm text-text">Map not available</p>
                            )}
                        </section>


                        {/* Attributes */}
                        <div className="grid md:grid-cols-2 gap-8 mb-4">
                            {/* Unique Attributes */}
                            {((uniqueVenueAttributes?.length ?? 0) > 0 || editing) && <section className="bg-surface p-6 rounded-lg">
                                {editing ? (
                                    <>
                                        <h2 className="mb-3 font-semibold text-text">Venue attributes</h2>
                                        <div className="space-y-2">
                                            {freeformAttributes.map((item, index) => (
                                                <div key={`unique-${index}`} className="flex gap-2">
                                                    <input aria-label="Attribute name" value={item.attribute} onChange={(event) => setFreeformAttributes((current) => current.map((attribute, currentIndex) => currentIndex === index ? { ...attribute, attribute: event.target.value } : attribute))} placeholder="Attribute" className="min-w-0 flex-1 rounded border border-default bg-bg px-2 py-1 text-text" />
                                                    <input aria-label="Attribute value" value={item.value} onChange={(event) => setFreeformAttributes((current) => current.map((attribute, currentIndex) => currentIndex === index ? { ...attribute, value: event.target.value } : attribute))} placeholder="Value" className="min-w-0 flex-1 rounded border border-default bg-bg px-2 py-1 text-text" />
                                                    <button type="button" onClick={() => removeAttribute(freeformAttributes, index, setFreeformAttributes)} className="rounded border border-default p-2 text-red-500" aria-label="Remove attribute"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={addFreeformAttribute} className="mt-3 inline-flex items-center gap-1 rounded border border-default px-2 py-1 text-sm font-semibold text-text"><Plus className="h-4 w-4" />Add attribute</button>
                                    </>
                                ) : (
                                    <ul className="text-text">
                                        {uniqueVenueAttributes?.map((attr, index) => (
                                            <li key={index} className="m-2 w-fit rounded px-2 py-1 font-bold text-white transition hover:opacity-80" style={{ backgroundColor: `hsl(${Math.random() * 360}, 40%, 50%)` }}>{prettifyAttribute(attr.attribute)}: {attr.value}</li>
                                        ))}
                                    </ul>
                                )}
                            </section>}

                            {/* Rating Attributes */}
                            {((aggregatedVenueAttributes?.length ?? 0) > 0 || editing) && <section className="bg-surface p-6 rounded-lg">
                                {editing ? (
                                    <>
                                        <h2 className="mb-3 font-semibold text-text">Venue ratings</h2>
                                        <div className="space-y-2">
                                            {starAttributes.map((item, index) => (
                                                <div key={`rating-${index}`} className="flex gap-2">
                                                    <input aria-label="Rating name" value={item.attribute} onChange={(event) => setStarAttributes((current) => current.map((attribute, currentIndex) => currentIndex === index ? { ...attribute, attribute: event.target.value } : attribute))} placeholder="Rating" className="min-w-0 flex-1 rounded border border-default bg-bg px-2 py-1 text-text" />
                                                    <input aria-label="Rating value" type="number" min={1} max={5} value={item.value} onChange={(event) => setStarAttributes((current) => current.map((attribute, currentIndex) => currentIndex === index ? { ...attribute, value: Number(event.target.value) } : attribute))} className="w-20 rounded border border-default bg-bg px-2 py-1 text-text" />
                                                    <button type="button" onClick={() => removeAttribute(starAttributes, index, setStarAttributes)} className="rounded border border-default p-2 text-red-500" aria-label="Remove rating"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={addStarAttribute} className="mt-3 inline-flex items-center gap-1 rounded border border-default px-2 py-1 text-sm font-semibold text-text"><Plus className="h-4 w-4" />Add rating</button>
                                    </>
                                ) : (
                                    <ul className="text-text">
                                        {aggregatedVenueAttributes?.map((attr, index) => (
                                            <li key={index}>{prettifyAttribute(attr.attribute)}: {'★'.repeat(Math.round(attr.average))}{'☆'.repeat(5 - Math.round(attr.average))} ({attr.average}/5)</li>
                                        ))}
                                    </ul>
                                )}
                            </section>}
                        </div>


                        <CommunityMediaGallery
                            items={(venueComments ?? []).flatMap((comment) =>
                                comment.mediaPaths.map((path) => ({ path, eventId: comment.event_id, eventName: comment.eventName }))
                            )}
                        />

                        {/* Comments section */}

                        {(ratingCount > 0 || textComments.length > 0) && (
                            <section className="mb-4 bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-4">Reviews &amp; Comments</h2>
                                <div className="mb-5 rounded-lg border border-default p-4">
                                    <p className="text-sm text-muted mb-2">Aggregate Rating</p>
                                    {ratingCount > 0 ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star key={star} size={18} className={star <= Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                                                ))}
                                            </div>
                                            <p className="text-sm text-text">{averageRating.toFixed(1)} out of 5 ({ratingCount} rating{ratingCount === 1 ? '' : 's'})</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted">No ratings yet.</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {textComments.length > 0 ? textComments.map((comment, index) => (
                                        <blockquote key={`${comment.event_id}-${comment.created_at}-${index}`} className="rounded-lg border border-default p-4">
                                            <p className="text-sm text-text">&ldquo;{comment.comment}&rdquo;</p>
                                            <footer className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                                                <span>{comment.username}</span>
                                                <span aria-hidden="true">&middot;</span>
                                                <Link href={`/events/${comment.event_id}`} className="font-semibold text-accent hover:underline">
                                                    {comment.eventName}
                                                </Link>
                                            </footer>
                                        </blockquote>
                                    )) : <p className="text-sm text-muted">No written comments yet.</p>}
                                </div>
                            </section>
                        )}


                        {/* Events */}
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Upcoming Events */}
                            <section className="bg-surface p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-6 h-6 text-purple-500" />
                                    <h2 className="font-semibold text-text text-lg">Upcoming Events</h2>
                                </div>
                                <div className="space-y-3">
                                    {upcomingEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" event={event} />

                                        // <div key={event.id} className="border-l-4 border-purple-500 pl-4">
                                        //     <p className="text-gray-900 font-medium">{event.title}</p>
                                        //     <p className="text-sm text-gray-600">
                                        //         {event.startdate} at {event.starttime}
                                        //     </p>
                                        // </div>
                                    ))}
                                </div>
                            </section>

                            {/* Recent Events */}
                            <section className="bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-2">Recent Events</h2>
                                <div className="space-y-3">
                                    {pastEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" event={event} />
                                        // <div key={event.id} className="border-l-4 border-gray-300 pl-4">
                                        //     <p className="text-gray-900 font-medium">{event.title}</p>
                                        //     <p className="text-sm text-gray-600">{event.startdate}</p>
                                        // </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div>
                        <section className="bg-surface p-6 rounded-lg sticky top-4">
                            <h2 className="font-semibold text-text text-lg mb-2">Similar Venues</h2>
                            <div className="space-y-4">
                                {similarVenues.map((v) => (

                                    <a key={v.id} href={`/venues/${v.id}`} className="block hover-bg-accent-soft p-3 rounded border border-default hover:border-accent transition">
                                        <p className="font-medium text-text">{v.name}</p>
                                        <p className="text-sm text-text">{v.type}</p>
                                    </a>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}