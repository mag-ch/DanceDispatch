'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, MapPin, Calendar, Share2, X } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { Event, EventReview, Host } from '@/lib/utils';
import { DisplayEventReview, EventMediaGallery, ReviewModal } from '@/app/components/EventReview';
import { SaveEventButton } from '@/app/components/SaveEventButton';
import { RelatedEventCard } from '@/app/components/EventCard';
import { ShareModal } from '@/app/components/ShareModal';
import { AuthRequiredModal } from '@/app/components/AuthRequiredModal';
import { openInMaps } from '@/lib/utils_supabase';
import { canEditDetails } from '@/lib/supabase/client';

interface EventDetailClientProps {
    event: Event;
    eventReviews: EventReview[];
    relatedEvents: Event[];
    venueAddress: string;
    showReviewModal?: boolean;
    hostPreviousReviewsMap?: Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; comment: string }>>;
    venuePreviousReviewsMap?: Map<string, Array<{ eventId: string; eventName: string; username: string; rating: number; comment: string }>>;
}


export function EventDetailClient({ event, eventReviews, relatedEvents, venueAddress, showReviewModal = false, hostPreviousReviewsMap = new Map(), venuePreviousReviewsMap = new Map() }: EventDetailClientProps) {
    const { session, loading: authLoading } = useAuth();
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isSavedEvent, setIsSavedEvent] = useState<boolean | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showAttendanceConfirmModal, setShowAttendanceConfirmModal] = useState(false);
    const [isConfirmingAttendance, setIsConfirmingAttendance] = useState(false);
    const [attendanceConfirmError, setAttendanceConfirmError] = useState<string | null>(null);
    const [isEditingHosts, setIsEditingHosts] = useState(false);
    const [eventHosts, setEventHosts] = useState(() =>
        (event.hostNames ?? []).map((name, index) => ({
            id: event.hostIDs?.[index] ?? `${index}`,
            name,
        }))
    );

    const previousReviewGroups = (() => {
        const groups = new Map<string, { eventId: string; eventName: string; sourceReviews: Map<string, Array<{username: string; rating: number; comment: string }>> }>();


        // Process host reviews
        hostPreviousReviewsMap.forEach((reviews, hostId) => {
            const hostName = eventHosts.find((host) => host.id === hostId)?.name || 'Host';
            const sourceLabel = `Host: ${hostName}`;
            for (const review of reviews) {
                if (!groups.has(review.eventName)) {
                    groups.set(review.eventName, {
                        eventId: review.eventId,
                        eventName: review.eventName,
                        sourceReviews: new Map(),
                    });
                }
                const group = groups.get(review.eventName);
                if (group) {
                    if (!group.sourceReviews.has(sourceLabel)) {
                        group.sourceReviews.set(sourceLabel, []);
                    }
                    group.sourceReviews.get(sourceLabel)?.push({
                        username: review.username,
                        rating: review.rating,
                        comment: review.comment,
                    });
                }
            }
            // Note: We've lost individual eventId mapping with the simplified data
            // For now, aggregate all reviews under a generic "previous events" group
            // A better solution would be to preserve eventId in the server response
        });

        // Process venue reviews  
        venuePreviousReviewsMap.forEach((reviews) => {
            for (const review of reviews) {
                if (!groups.has(review.eventName)) {
                    groups.set(review.eventName, {
                        eventId: review.eventId,
                        eventName: review.eventName,
                        sourceReviews: new Map(),
                    });
                }
                const group = groups.get(review.eventName);
                if (group) {
                    const sourceLabel = `Venue: ${venueAddress}`;
                    if (!group.sourceReviews.has(sourceLabel)) {
                        group.sourceReviews.set(sourceLabel, []);
                    }
                    group.sourceReviews.get(sourceLabel)?.push({
                        username: review.username,
                        rating: review.rating,
                        comment: review.comment,
                    });
                }
            }
            // Similarly, we've lost eventId mapping for venue reviews
        });

        return Array.from(groups.values());
    })();
    const [allHosts, setAllHosts] = useState<Host[]>([]);
    const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);
    const [hostSearchQuery, setHostSearchQuery] = useState('');
    const [isLoadingHostOptions, setIsLoadingHostOptions] = useState(false);
    const [isSavingHosts, setIsSavingHosts] = useState(false);
    const [hostEditorError, setHostEditorError] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isEditingEventDetails, setIsEditingEventDetails] = useState(false);
    const [isSavingEventDetails, setIsSavingEventDetails] = useState(false);
    const [eventDetailEditError, setEventDetailEditError] = useState<string | null>(null);
    const [eventDetailEditForm, setEventDetailEditForm] = useState({
        title: event.title ?? '',
        startdate: event.startdate ?? '',
        starttime: event.starttime ? event.starttime.slice(0, 5) : '',
        enddate: event.enddate ?? '',
        endtime: event.endtime ? event.endtime.slice(0, 5) : '',
        description: event.description ?? '',
        location: event.location ?? '',
        externallink: event.externallink ?? '',
        price: event.price?.toString() ?? '',
    });
    const isPastEvent = new Date(`${event.enddate || event.startdate}T${event.endtime || event.starttime || '23:59:59'}`) < new Date();

    useEffect(() => {
        let isMounted = true;

        if (authLoading || !session) {
            setIsSavedEvent(null);
            return () => {
                isMounted = false;
            };
        }

        fetch(`/api/users/saved-events/${event.id}`)
            .then((response) => response.json())
            .then((data) => {
                if (isMounted) {
                    setIsSavedEvent(Boolean(data?.isSaved));
                }
            })
            .catch(() => {
                if (isMounted) {
                    setIsSavedEvent(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [authLoading, event.id, session]);

    const openReviewFlow = async () => {
        if (!session) {
            setShowAuthModal(true);
            return;
        }

        if (!isPastEvent) {
            setIsReviewModalOpen(true);
            return;
        }

        let savedState = isSavedEvent;
        if (savedState === null) {
            try {
                const response = await fetch(`/api/users/saved-events/${event.id}`);
                const data = await response.json().catch(() => null);
                savedState = Boolean(data?.isSaved);
                setIsSavedEvent(savedState);
            } catch {
                savedState = false;
                setIsSavedEvent(false);
            }
        }

        if (savedState) {
            setIsReviewModalOpen(true);
            return;
        }

        setAttendanceConfirmError(null);
        setShowAttendanceConfirmModal(true);
    };

    useEffect(() => {
        if (authLoading || !showReviewModal) return;
        void openReviewFlow();
    }, [authLoading, showReviewModal, session, isSavedEvent, isPastEvent]);

    const handleConfirmPastAttendance = async () => {
        if (!session) {
            setShowAttendanceConfirmModal(false);
            setShowAuthModal(true);
            return;
        }

        try {
            setIsConfirmingAttendance(true);
            setAttendanceConfirmError(null);

            const response = await fetch(`/api/users/saved-events/${event.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saveToggle: true }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to save RSVP before review.');
            }

            setIsSavedEvent(true);
            setShowAttendanceConfirmModal(false);
            setIsReviewModalOpen(true);
        } catch (error) {
            setAttendanceConfirmError(error instanceof Error ? error.message : 'Failed to save RSVP before review.');
        } finally {
            setIsConfirmingAttendance(false);
        }
    };

    const eventImageSrc = event.imageurl ? event.imageurl : '/images/default_event.jpg';
    const canEditHosts = !authLoading && Boolean(session);
    const normalizedHostSearchQuery = hostSearchQuery.trim();
    const filteredHosts = allHosts.filter((host) => host.name.toLowerCase().includes(normalizedHostSearchQuery.toLowerCase()));
    const selectedHostTokens = selectedHostIds
        .map((hostId) => {
            const selectedHost = allHosts.find((host) => String(host.id) === hostId);
            if (selectedHost) {
                return { id: String(selectedHost.id), name: selectedHost.name };
            }

            const fallbackHost = eventHosts.find((host) => host.id === hostId);
            if (fallbackHost) {
                return fallbackHost;
            }

            return null;
        })
        .filter((host): host is { id: string; name: string } => Boolean(host));

    useEffect(() => {
        setEventHosts(
            (event.hostNames ?? []).map((name, index) => ({
                id: event.hostIDs?.[index] ?? `${index}`,
                name,
            }))
        );
    }, [event.hostIDs, event.hostNames]);

    useEffect(() => {
        setEventDetailEditForm({
            title: event.title ?? '',
            startdate: event.startdate ?? '',
            starttime: event.starttime ? event.starttime.slice(0, 5) : '',
            enddate: event.enddate ?? '',
            endtime: event.endtime ? event.endtime.slice(0, 5) : '',
            description: event.description ?? '',
            location: event.location ?? '',
            externallink: event.externallink ?? '',
            price: event.price?.toString() ?? '',
        });
    }, [event.description, event.enddate, event.endtime, event.externallink, event.id, event.location, event.price, event.startdate, event.starttime, event.title]);

    useEffect(() => {
        if ((!isEditingHosts && !isEditingEventDetails) || !session || allHosts.length > 0) {
            return;
        }

        const loadHosts = async () => {
            try {
                setIsLoadingHostOptions(true);
                setHostEditorError(null);
                const response = await fetch('/api/hosts');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error ?? 'Failed to load hosts');
                }

                setAllHosts(Array.isArray(data) ? data : []);
            } catch (error) {
                setHostEditorError(error instanceof Error ? error.message : 'Failed to load hosts');
            } finally {
                setIsLoadingHostOptions(false);
            }
        };

        loadHosts();
    }, [allHosts.length, isEditingEventDetails, isEditingHosts, session]);

    const formatEventDate = (dateStr?: string) => {
        if (!dateStr) return 'Date TBD';

        const normalized = dateStr.trim();
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            // Use local noon to avoid DST/UTC boundary shifts.
            return new Date(year, month, day, 12, 0, 0).toDateString();
        }

        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? normalized : parsed.toDateString();
    };

    const eventStartAt = event.startdate && event.starttime
        ? `${event.startdate}T${event.starttime}`
        : event.startdate ?? null;

    const normalizeTimeInput = (value: string) => {
        if (!value) return '';
        return value.length === 5 ? `${value}:00` : value;
    };

    const openEventDetailsEditor = () => {
        setEventDetailEditError(null);
        setEventDetailEditForm({
            title: event.title ?? '',
            startdate: event.startdate ?? '',
            starttime: event.starttime ? event.starttime.slice(0, 5) : '',
            enddate: event.enddate ?? '',
            endtime: event.endtime ? event.endtime.slice(0, 5) : '',
            description: event.description ?? '',
            location: event.location ?? '',
            externallink: event.externallink ?? '',
            price: event.price?.toString() ?? '',
        });
        setSelectedHostIds(eventHosts.map((host) => host.id));
        setHostSearchQuery('');
        setIsEditingEventDetails(true);
    };

    const handleSaveEventDetails = async () => {
        try {
            setIsSavingEventDetails(true);
            setEventDetailEditError(null);

            const payload: Record<string, string | number> = {
                title: eventDetailEditForm.title.trim(),
                start: eventDetailEditForm.startdate + 'T' + normalizeTimeInput(eventDetailEditForm.starttime),
                end: eventDetailEditForm.enddate + 'T' + normalizeTimeInput(eventDetailEditForm.endtime),
                description: eventDetailEditForm.description,
                location: eventDetailEditForm.location.trim(),
                externallink: eventDetailEditForm.externallink.trim(),
            };

            if (eventDetailEditForm.price !== '') {
                payload.price = Number(eventDetailEditForm.price);
            }

            const response = await fetch(`/api/events/${event.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error ?? 'Failed to update event');
            }

            const hostIdsChanged =
                selectedHostIds.length !== eventHosts.length ||
                selectedHostIds.some((hostId) => !eventHosts.some((host) => host.id === hostId));

            if (hostIdsChanged) {
                const hostResponse = await fetch(`/api/events/${event.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hostIds: selectedHostIds }),
                });
                const hostData = await hostResponse.json().catch(() => null);

                if (!hostResponse.ok) {
                    throw new Error(hostData?.error ?? 'Failed to update hosts');
                }
            }

            window.location.reload();
        } catch (error) {
            setEventDetailEditError(error instanceof Error ? error.message : 'Failed to update event');
        } finally {
            setIsSavingEventDetails(false);
        }
    };

    const toggleSelectedHost = (hostId: string) => {
        setSelectedHostIds((current) => (
            current.includes(hostId)
                ? current.filter((id) => id !== hostId)
                : [...current, hostId]
        ));
    };

    const handleHostEditorToggle = async () => {
        if (!canEditHosts) {
            return;
        }

        if (!isEditingHosts) {
            setHostEditorError(null);
            setSelectedHostIds(eventHosts.map((host) => host.id));
            setHostSearchQuery('');
            setIsEditingHosts(true);
            return;
        }

        try {
            setIsSavingHosts(true);
            setHostEditorError(null);

            const currentHostIds = eventHosts.map((host) => host.id);
            const hasChangedSelection =
                selectedHostIds.length !== currentHostIds.length
                || selectedHostIds.some((hostId) => !currentHostIds.includes(hostId));

            if (!hasChangedSelection) {
                setHostSearchQuery('');
                setIsEditingHosts(false);
                return;
            }

            const response = await fetch(`/api/events/${event.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostIds: selectedHostIds }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error ?? 'Failed to update hosts');
            }

            const nextHosts = selectedHostIds
                .map((hostId) => {
                    const selectedHost = allHosts.find((host) => String(host.id) === hostId);
                    if (selectedHost) {
                        return { id: String(selectedHost.id), name: selectedHost.name };
                    }

                    const existingHost = eventHosts.find((host) => host.id === hostId);
                    return existingHost ?? null;
                })
                .filter((host): host is { id: string; name: string } => Boolean(host));

            setEventHosts(nextHosts);
            setSelectedHostIds([]);
            setHostSearchQuery('');
            setIsEditingHosts(false);
        } catch (error) {
            setHostEditorError(error instanceof Error ? error.message : 'Failed to update hosts');
        } finally {
            setIsSavingHosts(false);
        }
    };

    const [isCreatingNewHost, setIsCreatingNewHost] = useState(false);
    const [newHostTags, setNewHostTags] = useState('');
    const [hostCreationError, setHostCreationError] = useState<string | null>(null);

    const handleCreateNewHost = async () => {
        if (!normalizedHostSearchQuery.trim()) {
            setHostCreationError('Host name cannot be empty');
            return;
        }

        try {
            setHostCreationError(null);
            const response = await fetch('/api/hosts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: normalizedHostSearchQuery.trim(), tags: newHostTags.trim() }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.error ?? 'Failed to create host');
            }

            const createdHost = data;
            setAllHosts([...allHosts, createdHost]);
            toggleSelectedHost(String(createdHost.id));
            setNewHostTags('');
            setIsCreatingNewHost(false);
        } catch (error) {
            setHostCreationError(error instanceof Error ? error.message : 'Failed to create host');
        }
    };

    return (
        <div className="min-h-screen bg-bg">
            {/* Flyer Section */}
            <div className="relative w-full h-96 bg-bg group">
                <button
                    type="button"
                    className="absolute inset-0 block cursor-zoom-in"
                    onClick={() => setShowImageModal(true)}
                    aria-label={`Open full image for ${event.title}`}
                >
                    <Image
                        src={eventImageSrc}
                        alt={event.title}
                        fill
                        className="object-cover"
                        loading="eager"
                        priority
                    />
                </button>
                <button
                    className="absolute top-4 left-4 bg-black bg-opacity-40 hover:bg-opacity-80 text-white font-semibold px-3 py-2 rounded-lg transition-all flex items-center gap-2 z-10"
                    onClick={async () => {
                        const url = prompt('Enter image URL:');
                        if (url && event?.id) {
                            const response = await fetch(`/api/events/${event.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageurl: url })
                            });
                            if (response.ok) {
                                window.location.reload();
                            }
                        }
                    }}
                >
                    📸 Upload
                </button>
            </div>

           {showImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6"
                    onClick={() => {
                        // console.log('backdrop clicked');
                        setShowImageModal(false);
                    }}                    role="dialog"
                    aria-modal="true"
                    aria-label={`${event.title} image preview`}
                >
                    <div className="relative flex w-full max-w-[75vw] max-h-[75vh] items-center justify-center">
                        <button
                            type="button"
                            className="absolute right-0 top-0 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowImageModal(false);
                            }}
                            aria-label="Close image preview"
                        >
                            <X size={20} />
                        </button>
                        <div
                            className="relative h-full w-full overflow-auto rounded-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={eventImageSrc}
                                alt={event.title}
                                fill
                                className="object-contain"
                                sizes="100vw"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {isEditingEventDetails && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
                    <div className="w-full max-w-[75vw] max-h-[75vh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-text">Edit Event Details</h2>
                            <button
                                type="button"
                                className="rounded-full p-2 text-muted transition hover:bg-accent"
                                onClick={() => setIsEditingEventDetails(false)}
                                aria-label="Close editor"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-text">Event name</label>
                                <input
                                    type="text"
                                    value={eventDetailEditForm.title}
                                    onChange={(event) => setEventDetailEditForm((current) => ({ ...current, title: event.target.value }))}
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-text">Start date</label>
                                    <input
                                        type="date"
                                        value={eventDetailEditForm.startdate}
                                        onChange={(event) => setEventDetailEditForm((current) => ({ ...current, startdate: event.target.value }))}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-text">Start time</label>
                                    <input
                                        type="time"
                                        value={eventDetailEditForm.starttime}
                                        onChange={(event) => setEventDetailEditForm((current) => ({ ...current, starttime: event.target.value }))}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-text">End date</label>
                                    <input
                                        type="date"
                                        value={eventDetailEditForm.enddate}
                                        onChange={(event) => setEventDetailEditForm((current) => ({ ...current, enddate: event.target.value }))}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-text">End time</label>
                                    <input
                                        type="time"
                                        value={eventDetailEditForm.endtime}
                                        onChange={(event) => setEventDetailEditForm((current) => ({ ...current, endtime: event.target.value }))}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-text">Description</label>
                                <textarea
                                    value={eventDetailEditForm.description}
                                    onChange={(event) => setEventDetailEditForm((current) => ({ ...current, description: event.target.value }))}
                                    rows={5}
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-text">Location</label>
                                <input
                                    type="text"
                                    value={eventDetailEditForm.location}
                                    onChange={(event) => setEventDetailEditForm((current) => ({ ...current, location: event.target.value }))}
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-text">External link</label>
                                    <input
                                        type="url"
                                        value={eventDetailEditForm.externallink}
                                        onChange={(event) => setEventDetailEditForm((current) => ({ ...current, externallink: event.target.value }))}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold text-text">Price</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={eventDetailEditForm.price}
                                        onChange={(event) => setEventDetailEditForm((current) => ({ ...current, price: event.target.value }))}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text outline-none"
                                    />
                                </div>
                            </div>
                            <div className="rounded-lg border border-default p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h3 className="text-lg font-semibold text-text">Hosts</h3>
                                    <span className="text-sm text-muted">Select the hosts attached to this event</span>
                                </div>
                                <div className="mb-3 w-full rounded-lg border border-default bg-bg px-3 py-2">
                                    <div className="mb-2 flex flex-wrap gap-2">
                                        {selectedHostTokens.map((host) => (
                                            <button
                                                key={host.id}
                                                type="button"
                                                onClick={() => toggleSelectedHost(host.id)}
                                                className="rounded bg-accent px-2 py-1 text-xs font-semibold text-text transition hover:bg-accent-soft"
                                            >
                                                {host.name} x
                                            </button>
                                        ))}
                                        {selectedHostTokens.length === 0 && (
                                            <span className="text-xs text-muted">No hosts selected yet.</span>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={hostSearchQuery}
                                        onChange={(searchEvent) => setHostSearchQuery(searchEvent.target.value)}
                                        placeholder="Search hosts by name"
                                        className="w-full bg-transparent text-sm text-text outline-none"
                                    />
                                </div>
                                {isLoadingHostOptions && <p className="text-sm text-muted">Loading hosts...</p>}
                                {filteredHosts.length > 0 && (
                                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-default p-3">
                                        {filteredHosts.map((host) => {
                                            const hostId = String(host.id);
                                            const isSelected = selectedHostIds.includes(hostId);

                                            return (
                                                <label key={hostId} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent-soft">
                                                    <span className="text-sm font-medium text-text">{host.name}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectedHost(hostId)}
                                                        className="h-4 w-4"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                {normalizedHostSearchQuery && filteredHosts.length === 0 && (
                                    <p className="mt-3 text-sm text-muted">No hosts match your search.</p>
                                )}
                            </div>
                            {eventDetailEditError && <p className="text-sm text-red-500">{eventDetailEditError}</p>}
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                className="rounded-lg border border-default px-4 py-2 font-semibold text-text transition hover:bg-accent"
                                onClick={() => setIsEditingEventDetails(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-accent px-4 py-2 font-semibold text-text transition hover:bg-accent-soft disabled:opacity-60"
                                onClick={handleSaveEventDetails}
                                disabled={isSavingEventDetails}
                            >
                                {isSavingEventDetails ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2">
                        {/* Title & Actions */}
                        <div className="mb-6">
                            <h1 className="text-4xl font-bold mb-4 text-text">{event.title}</h1>
                            <div className="flex gap-4">
                                <SaveEventButton entity='events' entityId={event.id} isDisabled={isPastEvent} />
                                <button className="p-2 hover:bg-accent" onClick={() => setShowShareModal(true)} type="button">
                                    <Share2 className="text-gray-600"/>
                                </button>
                                {(event.externallink && event.externallink.length > 3) && <a
                                    href={event.externallink || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className=" btn-highlighted px-6 py-2 rounded-lg font-semibold transition"
                                >
                                    {event.price != undefined ? (event.price == 0 ? 'Free RSVP' : `Buy Tickets - From $${event.price}`) : 'Buy Tickets'}
                                </a>}
                                {canEditDetails(session?.user?.id) && (
                                    <button
                                        type="button"
                                        className="px-4 py-2 rounded-lg font-semibold text-text border border-default hover:bg-accent transition"
                                        onClick={openEventDetailsEditor}
                                    >
                                        ✎ Edit Event Details
                                    </button>
                                )}
                                {(!event.externallink || event.externallink.length <= 3) && event.price != undefined && <span className="px-2 py-2 rounded-lg font-semibold text-muted">
                                    {event.price != undefined ? (event.price == 0 ? 'Free Event' : `$${event.price}`) : 'Price TBD'}
                                </span>}
                            </div>
                        </div>

                        {/* Event Details */}
                        <div className="bg-surface rounded-lg p-6 mb-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-muted">Date</p>
                                    <p className="font-semibold text-text">{formatEventDate(event.startdate)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="text-blue-600" />
                                <div>
                                    <p className="text-sm text-muted">Time</p>
                                    <p className="font-semibold text-text">{new Date(`2000-01-01 ${event.starttime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} to {new Date(`2000-01-01 ${event.endtime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => openInMaps(event.location)}
                                className="flex items-center gap-3 hover:text-blue-500 transition-colors text-left"
                            >
                                <MapPin className="text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-sm text-muted">Location</p>
                                    <p className="font-semibold text-text hover:underline">{event.location}</p>
                                </div>
                            </button>
                        </div>

                        {/* Description */}
                        {event.description && (
                            <div className="bg-surface rounded-lg p-6 mb-6">
                                <h2 className="text-2xl font-bold mb-4 text-text">About</h2>
                                <p className="text-text">{event.description}</p>
                            </div>
                        )}
                        <div>
                            <EventMediaGallery
                            eventId={event.id}
                            />
                        </div>

                        {/* Hosts */}
                        {(eventHosts.length > 0 || canEditHosts) &&
                        ( <div className="bg-surface rounded-lg p-4 mb-6"> 
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <h2 className="text-2xl font-bold text-text">Hosted By</h2>
                                {canEditHosts && (
                                    <button
                                        type="button"
                                        className="rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text transition hover-bg-accent-soft disabled:opacity-60"
                                        onClick={handleHostEditorToggle}
                                        disabled={isSavingHosts}
                                    >
                                        {isEditingHosts ? (isSavingHosts ? 'Saving...' : 'Done') : 'Edit Hosts'}
                                    </button>
                                )}
                            </div>
                            {isEditingHosts ? (
                                <div className="rounded-lg border border-default p-4">
                                    <p className="mb-3 text-sm text-muted">Choose additional hosts to attach to this event.</p>
                                    <div className="mb-3 w-full rounded-lg border border-default bg-bg px-3 py-2">
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {selectedHostTokens.map((host) => (
                                                <button
                                                    key={host.id}
                                                    type="button"
                                                    onClick={() => toggleSelectedHost(host.id)}
                                                    className="rounded bg-accent px-2 py-1 text-xs font-semibold text-text transition hover-bg-accent-soft"
                                                >
                                                    {host.name} x
                                                </button>
                                            ))}
                                            {selectedHostTokens.length === 0 && (
                                                <span className="text-xs text-muted">No hosts selected yet.</span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={hostSearchQuery}
                                            onChange={(searchEvent) => setHostSearchQuery(searchEvent.target.value)}
                                            placeholder="Search hosts by name"
                                            className="w-full bg-transparent text-sm text-text outline-none"
                                        />
                                    </div>
                                    {isLoadingHostOptions && (
                                        <p className="text-sm text-muted">Loading hosts...</p>
                                    )}
                                    {filteredHosts.length > 0 && (
                                        <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-default p-3">
                                            {filteredHosts.map((host) => {
                                                const hostId = String(host.id);
                                                const isSelected = selectedHostIds.includes(hostId);

                                                return (
                                                    <label key={hostId} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover-bg-accent-soft">
                                                        <span className="text-sm font-medium text-text">{host.name}</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectedHost(hostId)}
                                                            className="h-4 w-4"
                                                        />
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {normalizedHostSearchQuery && filteredHosts.length === 0 && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted">No hosts match your search.</p>
                                            {!isCreatingNewHost ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCreatingNewHost(true)}
                                                    className="w-full text-sm px-3 py-2 rounded-lg border border-default text-text hover:bg-accent-soft transition font-semibold"
                                                >
                                                    + Create New Host
                                                </button>
                                            ) : (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={newHostTags}
                                                        onChange={(e) => setNewHostTags(e.target.value)}
                                                        placeholder="Enter host tags, comma separated"
                                                        className="w-full text-sm px-3 py-2 rounded-lg border border-default bg-bg text-text outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleCreateNewHost}
                                                            className="flex-1 text-sm px-3 py-2 rounded-lg bg-accent text-text font-semibold hover:bg-accent-soft transition"
                                                        >
                                                            Create
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsCreatingNewHost(false);
                                                                setNewHostTags('');
                                                                setHostCreationError(null);
                                                            }}
                                                            className="flex-1 text-sm px-3 py-2 rounded-lg border border-default text-text hover:bg-accent-soft transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    {hostCreationError && <p className="text-sm text-red-500">{hostCreationError}</p>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {hostEditorError && <p className="mt-3 text-sm text-red-500">{hostEditorError}</p>}
                                </div>
                            ) : eventHosts.length > 0 ? eventHosts.map((host) => (
                                <a key={host.id} href={`/hosts/${encodeURIComponent(host.id)}`} className="text-sm font-bold px-3 py-1 rounded m-2 inline-block text-text bg-accent transition">
                                    {host.name.trim().replace(/[\[\]']/g, '')}
                                </a>
                            )) : (
                                <p className="text-sm text-muted">No hosts listed yet.</p>
                            )}
                        </div>)}  

                        {/* Venue */}
                        <div className="bg-surface rounded-lg p-6 mb-6">
                            <h2 className="text-2xl text-text font-bold mb-4">Venue Information</h2>
                            <a href={`/venues/${encodeURIComponent(event.locationid || '')}`} className="block border rounded-lg p-4 hover:shadow-md transition">
                                <h3 className="font-semibold text-text text-lg mb-2">{event.location}</h3>
                                <div className="flex items-center gap-2 text-muted">
                                    <MapPin size={18} />
                                    <p className="text-sm">{venueAddress}</p>
                                </div>
                            </a>
                        </div>

                        {/* Reviews Section */}
                        <div className="bg-surface rounded-lg p-6">
                            <h2 className="text-2xl font-bold mb-4 text-text">Reviews</h2>
                            <div >
                                {
                                    eventReviews.length === 0 ? <p className="text-muted">No reviews yet. Be the first to review!</p> :
                                        eventReviews.map((review, index) => (
                                            <DisplayEventReview key={index} review={review} />
                                        ))
                                }
                            </div>
                            <button
                                onClick={() => {
                                    void openReviewFlow();
                                }}
                                className="w-full mt-4 px-4 py-2 border rounded-lg hover-bg-accent-soft font-semibold text-text"
                            >
                                Write a Review
                            </button>
                            {isReviewModalOpen &&
                                <ReviewModal
                                    isOpen={isReviewModalOpen}
                                    event={event}
                                    onClose={() => setIsReviewModalOpen(false)}
                                    onSubmit={async (reviews) => {
                                        if (!event?.id) return;
                                        const response = await fetch(`/api/reviews/${event.id}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: reviews })
                                        });
                                        if (response.ok) {
                                            window.location.reload();
                                            return;
                                        }

                                        setIsReviewModalOpen(false);
                                    }}
                                />
                            }
                            <AuthRequiredModal
                                isOpen={showAuthModal}
                                onClose={() => setShowAuthModal(false)}
                                message={`Please log in or sign up to submit a review for ${event.title}.`}
                            />
                            {showAttendanceConfirmModal && (
                                <div
                                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6"
                                    onClick={() => setShowAttendanceConfirmModal(false)}
                                >
                                    <div
                                        className="w-full max-w-[75vw] max-h-[75vh] overflow-y-auto rounded-2xl border border-default bg-surface p-6 shadow-2xl"
                                        onClick={(modalEvent) => modalEvent.stopPropagation()}
                                        role="dialog"
                                        aria-modal="true"
                                        aria-label="Confirm attendance before writing review"
                                    >
                                        <h3 className="text-xl font-semibold text-text">Did you attend this event?</h3>
                                        <p className="mt-3 text-sm text-muted">
                                            This event has ended and you did not RSVP yet. If you attended, confirm now and we will RSVP this event for you before opening the review form.
                                        </p>
                                        <p className="mt-2 text-sm text-muted">
                                            Next time, RSVP before the event ends so your review flow is faster.
                                        </p>

                                        {attendanceConfirmError && (
                                            <p className="mt-3 text-sm text-red-500">{attendanceConfirmError}</p>
                                        )}

                                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowAttendanceConfirmModal(false)}
                                                className="rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text hover-bg-accent-soft"
                                                disabled={isConfirmingAttendance}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleConfirmPastAttendance();
                                                }}
                                                className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                                                disabled={isConfirmingAttendance}
                                            >
                                                {isConfirmingAttendance ? 'Confirming...' : 'Yes, I attended'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <ShareModal
                                isOpen={showShareModal}
                                onClose={() => setShowShareModal(false)}
                                entity="events"
                                entityId={event.id}
                                entityTitle={event.title}
                                eventStartAt={eventStartAt}
                            />
                        </div>

                        {/* Previous Event Review Groups */}
                        {previousReviewGroups.length > 0 && (
                            <div className="space-y mt-6">
                                <div className="bg-surface rounded-lg p-6">
                                    <h2 className="text-2xl font-bold text-text">Previous Reviews for Hosts and Venue</h2>
                                </div>
                                {previousReviewGroups.map((group) => {
                                    return (
                                        <div key={group.eventId} className="bg-surface rounded-lg p-6">
                                            <Link href={`/events/${group.eventId}`} className="text-lg font-semibold text-accent hover:underline block mb-4">
                                                {group.eventName}
                                            </Link>
                                            <div className="space-y-4">
                                                {Array.from(group.sourceReviews.entries()).map(([source, sourceReviews]) => (
                                                    <div key={source}>
                                                        <h4 className="font-semibold text-text mb-3">{source}</h4>
                                                        <div className="space-y-2 pl-4">
                                                            {sourceReviews.map((review, idx) => (
                                                                <div key={idx} className="text-sm">
                                                                    <div className="font-medium text-text mb-1">{review.username}</div>
                                                                    {review.comment && (
                                                                        <p className="text-text mb-2">{review.comment}</p>
                                                                    )}
                                                                    {review.rating && review.rating > 0 && (
                                                                        <div className="flex gap-1 mb-2">
                                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                                <Star
                                                                                    key={star}
                                                                                    size={14}
                                                                                    className={star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Related Events */}
                    <div>
                        <div className="bg-surface rounded-lg p-6 sticky top-8">
                            <h2 className="text-2xl text-text font-bold mb-4">Related Events</h2>
                            <div className="space-y-4">
                                {relatedEvents.map((relEvent) => (
                                    <RelatedEventCard key={relEvent.id} event={relEvent} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
