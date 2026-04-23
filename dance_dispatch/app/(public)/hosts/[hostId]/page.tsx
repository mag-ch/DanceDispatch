'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Image from 'next/image';
import { Calendar, Globe, Star, Pencil, Check, X } from 'lucide-react';
import { SearchResult } from '@/app/components/EventCard';
import { Host } from '@/lib/utils';
import { SoundcloudPlayer } from '@/app/components/MediaPreviews';
import { FollowEntityButton } from '@/app/components/SaveEventButton';
import { useAuth } from '@/app/providers/AuthContext';


export default function HostPage({ params }: { params: Promise<{ hostId: string }> }) {
    const { hostId } = use(params);
    const [host, setHost] = useState<Host | null>(null);
    const [loading, setLoading] = useState(true);
    const [pastEvents, setPastEvents] = useState<any[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [similarHosts, setSimilarHosts] = useState<Host[]>([]);
    const [hostMedia, setHostMedia] = useState<any[]>([]);
    const [hostComments, setHostComments] = useState<any[]>([]);

    const { session } = useAuth();
    const isAuthenticated = !!session && session.user.id == 'ba398812-06a0-4c48-9f15-0660d3af0047';

    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editTags, setEditTags] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState('soundcloud');
    const [mediaLink, setMediaLink] = useState('');
    const [mediaEmbedCode, setMediaEmbedCode] = useState('');
    const [mediaSaving, setMediaSaving] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);

    const startEditing = () => {
        if (!host) return;
        setEditName(host.name);
        setEditBio(host.bio ?? '');
        setEditTags(host.tags?.join(', ') ?? '');
        setSaveError(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setSaveError(null);
    };

    const saveEdits = async () => {
        if (!host) return;
        setSaving(true);
        setSaveError(null);
        try {
            const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
            const res = await fetch(`/api/hosts/${hostId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, bio: editBio, tags }),
            });
            if (!res.ok) {
                const err = await res.json();
                setSaveError(err.error ?? 'Failed to save');
                return;
            }
            setHost({ ...host, name: editName, bio: editBio, tags });
            setEditing(false);
        } catch {
            setSaveError('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const uploadHostImageUrl = async () => {
        if (!isAuthenticated || !host?.id) {
            return;
        }

        const imageUrl = window.prompt('Enter image URL:');
        if (!imageUrl) {
            return;
        }

        try {
            const response = await fetch(`/api/hosts/${host.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoUrl: imageUrl }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error ?? 'Failed to update host image');
            }

            setHost({ ...host, photoUrl: imageUrl });
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to update host image');
        }
    };

    const addHostMedia = async () => {
        if (!isAuthenticated) {
            return;
        }

        const trimmedLink = mediaLink.trim();
        const trimmedEmbedCode = mediaEmbedCode.trim();

        const trimmedType = mediaType.trim();

        if (!trimmedType) {
            setMediaError('Enter a media type.');
            return;
        }

        if (!trimmedLink && !trimmedEmbedCode) {
            setMediaError('Enter either a link or SoundCloud embed code.');
            return;
        }

        setMediaSaving(true);
        setMediaError(null);
        try {
            const response = await fetch(`/api/host-media/${hostId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: trimmedType,
                    link: trimmedLink,
                    embed_code: trimmedEmbedCode,
                }),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.error ?? 'Failed to add media');
            }

            setHostMedia((current) => [data, ...current]);
            setMediaLink('');
            setMediaEmbedCode('');
        } catch (error) {
            setMediaError(error instanceof Error ? error.message : 'Failed to add media');
        } finally {
            setMediaSaving(false);
        }
    };

    useEffect(() => {
        const fetchHost = async () => {
            try {
                const res = await fetch(`/api/hosts/${hostId}`);
                const data = await res.json();
                setHost(data);
            } catch (error) {
                console.error('Failed to fetch host:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHost();
    }, [hostId]);

    useEffect(() => {
        const fetchHostMedia = async () => {
            try {
                const res = await fetch(`/api/host-media/${hostId}`);
                const data = await res.json();
                setHostMedia(data);
            } catch (error) {
                console.error('Failed to fetch host media:', error);
            }
        };
        fetchHostMedia();
    }, [hostId]);

    useEffect(() => {
        if (!hostId) return;
        const fetchEvents = async () => {
            const res = await fetch(`/api/events?onlyUpcoming=false&hostId=${encodeURIComponent(hostId)}`);
            const events = await res.json();
            const past = events
                .filter((event: any) => new Date(`${event.startdate} ${event.starttime}`) < new Date())
                .sort((a: any, b: any) => new Date(`${b.startdate} ${b.starttime}`).getTime() - new Date(`${a.startdate} ${a.starttime}`).getTime())
                .slice(0, 5);
            const upcoming = events.filter((event: any) => new Date(`${event.startdate} ${event.starttime}`) >= new Date());
            setPastEvents(past);
            setUpcomingEvents(upcoming);
        };
        fetchEvents();
    }, [hostId]);

    useEffect(() => {
        if (!host) return;
        const fetchSimilarHosts = async () => {
            try {
                const res = await fetch(`/api/hosts?tags=${host.tags}&exclude=${hostId}`);
                const data = await res.json();
                setSimilarHosts(data.slice(0, 5));
            } catch (error) {
                console.error('Failed to fetch similar hosts:', error);
            }
        };
        fetchSimilarHosts();
    }, [host, hostId]);

    useEffect(() => {
        if (!hostId) return;
        const fetchHostComments = async () => {
            try {
                const res = await fetch(`/api/hosts/${hostId}/comments`);
                const data = await res.json();
                setHostComments(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('Failed to fetch host comments:', error);
            }
        };
        fetchHostComments();
    }, [hostId]);

    const ratedComments = hostComments.filter((comment) => Number(comment?.rating) > 0);
    const ratingCount = ratedComments.length;
    const averageRating =
        ratingCount > 0
            ? ratedComments.reduce((sum, comment) => sum + Number(comment.rating), 0) / ratingCount
            : 0;
    const averageRatingDisplay = averageRating.toFixed(1);
    const roundedAverageStars = Math.round(averageRating);

    if (loading) return <div className="p-8">Loading...</div>;
    if (!host) return <div className="p-8">Host not found</div>;

    return (
        <div className="min-h-screen bg-bg text-text">
            <div className="relative h-96 bg-bg">
                <Image
                    src={host.photoUrl === "" ? '/images/default_host.jpg' : host.photoUrl}
                    alt={host.name}
                    fill
                    className="object-cover"
                />
                {isAuthenticated && (
                    <button
                        type="button"
                        className="absolute top-4 left-4 z-10 rounded-lg bg-black/40 px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/75"
                        onClick={uploadHostImageUrl}
                    >
                        Upload Image URL
                    </button>
                )}
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <section className="bg-surface rounded-lg p-6 mb-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-col items-start gap-2 w-full">
                                    {editing ? (
                                        <div className="flex flex-col gap-2 w-full">
                                            <label className="text-sm text-muted">Tags (comma-separated)</label>
                                            <input
                                                className="bg-bg text-text border border-default rounded p-2 w-full"
                                                value={editTags}
                                                onChange={(e) => setEditTags(e.target.value)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {host.tags?.map((tag) => (
                                                <span key={tag} className="text-sm bg-surface border border-default px-3 py-1 rounded text-white" style={{ backgroundColor: `hsl(${Math.random() * 360}, 40%, 50%)` }}>
                                                    {tag.trim().replace(/[\[\]']/g, '')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {editing ? (
                                        <input
                                            className="text-4xl text-text font-bold bg-bg border border-default rounded p-2 w-full"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                        />
                                    ) : (
                                        <h1 className="text-4xl text-text font-bold">{host.name}</h1>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <FollowEntityButton entity="hosts" entityId={host.id} />
                                    {isAuthenticated && !editing && (
                                        <button onClick={startEditing} className="p-2 rounded border border-default hover:border-accent transition" title="Edit">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                    {editing && (
                                        <>
                                            <button onClick={saveEdits} disabled={saving} className="p-2 rounded border border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition" title="Save">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={cancelEditing} className="p-2 rounded border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition" title="Cancel">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {saveError && <p className="text-red-500 text-sm mt-2">{saveError}</p>}
                        </section>

                        {(host.bio || editing) && (
                            <section className="mb-8 bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-4">About</h2>
                                {editing ? (
                                    <textarea
                                        className="w-full bg-bg text-text border border-default rounded p-2 resize-none"
                                        rows={4}
                                        value={editBio}
                                        onChange={(e) => setEditBio(e.target.value)}
                                    />
                                ) : (
                                    <p className="text-muted">{host.bio}</p>
                                )}
                            </section>
                        )}

                        <section className="mb-8 bg-surface p-6 rounded-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <Globe className="w-5 h-5" />
                                <h2 className="font-semibold text-text text-lg">Links & Mixes</h2>
                            </div>

                            {isAuthenticated && editing && (
                                <div className="mb-6 rounded-lg border border-default p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-text">Add Media</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="flex flex-col gap-1">
                                            <span className="text-xs text-muted">Type</span>
                                            <input
                                                type="text"
                                                className="bg-bg text-text border border-default rounded p-2"
                                                placeholder="e.g. soundcloud, youtube, bandcamp"
                                                value={mediaType}
                                                onChange={(e) => setMediaType(e.target.value)}
                                            />
                                        </label>

                                        <label className="flex flex-col gap-1 md:col-span-1">
                                            <span className="text-xs text-muted">External Link</span>
                                            <input
                                                type="url"
                                                placeholder="https://..."
                                                className="bg-bg text-text border border-default rounded p-2"
                                                value={mediaLink}
                                                onChange={(e) => setMediaLink(e.target.value)}
                                            />
                                        </label>
                                    </div>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs text-muted">SoundCloud Embed Code (optional)</span>
                                        <textarea
                                            rows={3}
                                            className="bg-bg text-text border border-default rounded p-2 resize-y"
                                            placeholder="<iframe ...></iframe>"
                                            value={mediaEmbedCode}
                                            onChange={(e) => setMediaEmbedCode(e.target.value)}
                                        />
                                    </label>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            className="rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text transition hover:border-accent disabled:opacity-60"
                                            onClick={addHostMedia}
                                            disabled={mediaSaving}
                                        >
                                            {mediaSaving ? 'Saving...' : 'Add Media'}
                                        </button>
                                        {mediaError && <p className="text-sm text-red-500">{mediaError}</p>}
                                    </div>
                                </div>
                            )}

                            {hostMedia.length > 0 ? (
                                <div className="space-y-4">
                                    {hostMedia.map((media, index) => (
                                        <div key={media.id ?? `${media.type}-${index}`} className="rounded-lg border border-default p-4 space-y-3">
                                            <h3 className="text-base font-semibold capitalize">{media.type || 'Link'}</h3>
                                            {media.link && (
                                                <a
                                                    href={media.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-400 underline break-all"
                                                >
                                                    {media.link}
                                                </a>
                                            )}
                                            {media.embed_code && <SoundcloudPlayer embedCode={media.embed_code} />}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted">No media links yet.</p>
                            )}
                        </section>

                        <div className="grid md:grid-cols-2 gap-8 mb-8">
                            <section className="bg-surface p-6 rounded-lg">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="w-6 h-6 text-purple-500" />
                                    <h2 className="font-semibold text-text text-lg">Upcoming Events</h2>
                                </div>
                                <div className="space-y-3">
                                    {upcomingEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" />
                                    ))}
                                </div>
                            </section>

                            <section className="bg-surface p-6 rounded-lg">
                                <h2 className="font-semibold text-text text-lg mb-4">Recent Events</h2>
                                <div className="space-y-3">
                                    {pastEvents.map((event, index) => (
                                        <SearchResult key={`${event.id}-${index}`} header={event.title} subheader={event.description} date={event.startdate + " " + event.starttime} price={event.price} location={event.location} img={event.imageurl} entityId={event.id} entity="events" />
                                    ))}
                                </div>
                            </section>
                        </div>

                        {(hostComments.length > 0 || ratingCount > 0) && (
                            <section className="bg-surface rounded-lg p-6 mb-6">
                                <h2 className="font-semibold text-text text-lg mb-4">Reviews & Comments</h2>
                                <div className="mb-5 rounded-lg border border-default p-4">
                                    <p className="text-sm text-muted mb-2">Aggregate Rating</p>
                                    {ratingCount > 0 ? (
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star key={star} size={18} className={star <= roundedAverageStars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
                                                ))}
                                            </div>
                                            <p className="text-sm text-text">
                                                {averageRatingDisplay} out of 5 ({ratingCount} rating{ratingCount === 1 ? '' : 's'})
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted">No ratings yet.</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {hostComments.filter((comment) => Boolean(comment.comment)).length > 0 ? (
                                        hostComments
                                            .filter((comment) => Boolean(comment.comment))
                                            .map((comment, index) => (
                                                <div key={index} className="rounded-lg border border-default p-4">
                                                    <h4 className="text-sm font-semibold text-text mb-2">
                                                        {comment.privacy_level === 'public' ? comment.user_id : 'Anon'}
                                                    </h4>
                                                    <p className="text-sm text-text">{comment.comment}</p>
                                                </div>
                                            ))
                                    ) : (
                                        <p className="text-sm text-muted">No written comments yet.</p>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    <div>
                        <section className="bg-surface p-6 rounded-lg sticky top-4">
                            <h2 className="font-semibold text-text text-lg mb-4">You might be interested in...</h2>
                            <div className="space-y-4">
                                {similarHosts.map((h) => (
                                    <a key={h.id} href={`/hosts/${h.id}`} className="block hover-bg-accent-soft p-3 rounded border border-default hover:border-accent transition">
                                        <p className="font-medium text-text">{h.name}</p>
                                        <p className="text-sm text-muted">{h.tags?.join(', ')}</p>
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