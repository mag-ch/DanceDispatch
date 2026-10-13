'use client';

import React, { useEffect, useState } from 'react';
import { AuthRequiredModal } from '@/app/components/AuthRequiredModal';
import { useAuth } from '@/app/providers/AuthContext';
import { Venue } from '@/lib/utils';
import { ArrowLeft, Repeat, Upload, X } from 'lucide-react'; 
import type { Event } from "@/lib/utils";
import { HostSelector } from '@/app/components/HostSelector';
import { getRecurrenceSummary } from '@/lib/recurrence-options';

interface FormState {
    title: string;
    startdate: string;
    starttime: string;
    enddate: string;
    endtime: string;
    locationid: string;
    newVenueName: string;
    newVenueAddress: string;
    description: string;
    price: string;
    imageurl: string;
    externallink: string;
}

const empty: FormState = {
    title: '',
    startdate: '',
    starttime: '',
    enddate: '',
    endtime: '',
    locationid: '',
    newVenueName: '',
    newVenueAddress: '',
    description: '',
    price: '',
    imageurl: '',
    externallink: '',
};

export interface SubmitEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    initialData?: Event; // NEW
}

// Update the empty form helper to accept initial data
function createInitialForm(data?: Event): FormState {
    if (!data) return empty;

    return {
        title: data.title ?? '',
        description: data.description ?? '',
        startdate: data.startdate ?? '',
        starttime: data.starttime ?? '',
        enddate: data.enddate ?? '',
        endtime: data.endtime ?? '',
        locationid: data.locationid ?? '', 
        newVenueName: data.location ?? '',
        newVenueAddress: '',
        price: data.price !== undefined ? String(data.price) : '',
        imageurl: data.imageurl ?? '',
        externallink: data.externallink ?? '',
    };
}

export const SubmitEventModal: React.FC<SubmitEventModalProps> = ({ 
    isOpen, 
    onClose, 
    onBack,
    initialData
}) => {
    const { session, loading: authLoading } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [form, setForm] = useState<FormState>(createInitialForm(initialData));
    const [venues, setVenues] = useState<Venue[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateId, setDuplicateId] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isUploadingFlyer, setIsUploadingFlyer] = useState(false);
    const flyerInputRef = React.useRef<HTMLInputElement>(null);
    const isAddingNewVenue = form.locationid === '__new__';

    // Hosts state
    const [selectedHostIds, setSelectedHostIds] = useState<string[]>(initialData?.hostIDs ?? []);

    // Recurrence state
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
    const [dayOfWeek, setDayOfWeek] = useState<number>(5); // Default Friday
    const [dayOfMonth, setDayOfMonth] = useState<number>(1);
    const [endType, setEndType] = useState<'instances' | 'duration'>('instances');
    const [instances, setInstances] = useState<number>(4);
    const [durationMonths, setDurationMonths] = useState<number>(3);

    // Sync form and hosts with initialData
    useEffect(() => {
        if (initialData) {
            setForm(createInitialForm(initialData));
            setSelectedHostIds(initialData.hostIDs ?? []);
            if (initialData.startdate) {
                const parsed = new Date(`${initialData.startdate}T00:00:00`);
                if (!Number.isNaN(parsed.getTime())) {
                    setDayOfWeek(parsed.getDay());
                    setDayOfMonth(parsed.getDate());
                }
            }
        }
    }, [initialData]);

    // Show auth modal if user opens this while not logged in
    useEffect(() => {
        if (!isOpen || authLoading) return;
        if (!session) {
            setShowAuthModal(true);
        }
    }, [isOpen, authLoading, session]);

    // Load venues once for the location dropdown
    useEffect(() => {
        if (!isOpen || venues.length > 0) return;
        fetch('/api/venues')
            .then((r) => r.json())
            .then((data) => setVenues(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [isOpen, venues.length]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setError(null);
        setDuplicateId(null);

        if (name === 'startdate' && value) {
            const parsed = new Date(`${value}T00:00:00`);
            if (!Number.isNaN(parsed.getTime())) {
                setDayOfWeek(parsed.getDay());
                setDayOfMonth(parsed.getDate());
            }
        }
    };

    const handleFlyerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingFlyer(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/flyer-image', { method: 'POST', body: formData });
            const result = await response.json().catch(() => null);

            if (!response.ok) {
                setError(result?.error || 'Failed to upload flyer image.');
                return;
            }

            setForm((current) => ({ ...current, imageurl: result?.imageUrl || '' }));
        } catch {
            setError('Failed to upload flyer image.');
        } finally {
            setIsUploadingFlyer(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setDuplicateId(null);

        const body: Record<string, unknown> = {
            title: form.title,
            startdate: form.startdate,
            starttime: form.starttime || '00:00:00',
            enddate: form.enddate,
            endtime: form.endtime || '00:00:00',
        };
        if (form.locationid && form.locationid !== '__new__') body.locationid = form.locationid;
        if (isAddingNewVenue) {
            body.newVenueName = form.newVenueName.trim();
            body.newVenueAddress = form.newVenueAddress.trim();
        }
        if (form.description) body.description = form.description;
        if (form.price !== '') body.price = Number(form.price);
        if (form.imageurl) body.imageurl = form.imageurl;
        if (form.externallink) body.externallink = form.externallink;
        if (selectedHostIds.length > 0) body.hostIds = selectedHostIds;

        if (isRecurring) {
            body.recurrence = {
                frequency: recurrenceFrequency,
                dayOfWeek: recurrenceFrequency !== 'monthly' ? dayOfWeek : undefined,
                dayOfMonth: recurrenceFrequency === 'monthly' ? dayOfMonth : undefined,
                endType,
                instances: endType === 'instances' ? Number(instances) || 1 : undefined,
                durationMonths: endType === 'duration' ? Math.min(12, Math.max(1, Number(durationMonths) || 1)) : undefined,
            };
        }

        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.status === 401) {
                setShowAuthModal(true);
                return;
            }

            const data = await response.json();

            if (response.status === 409) {
                setDuplicateId(data.id);
                return;
            }

            if (!response.ok) {
                setError(data?.error ?? 'Failed to submit event');
                return;
            }

            setSuccess(true);
            setForm(empty);
            setSelectedHostIds([]);
            setIsRecurring(false);
            setTimeout(() => {
                setSuccess(false);
                onClose();
                window.location.href = `/events/${data.id}`;
            }, 1500);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    if (showAuthModal) {
        return (
            <AuthRequiredModal
                isOpen
                onClose={() => { setShowAuthModal(false); onClose(); }}
                message="Please log in or sign up to submit an event."
            />
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="relative w-full max-w-[75vw] rounded-xl bg-bg shadow-xl dark:bg-surface max-h-[75vh] overflow-y-auto">
                {/* NEW: Back button */}
                {onBack && (
                    <button
                        type="button"
                        className="absolute left-4 top-4 rounded-full p-1 text-muted hover:text-text"
                        onClick={onBack}
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <button
                    type="button"
                    className="absolute right-4 top-4 rounded-full p-1 text-muted hover:text-text"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    <h2 className="mb-4 text-2xl font-bold text-text">Submit an Event</h2>

                    {success && (
                        <p className="mb-4 rounded-lg bg-green-100 p-3 text-green-800 text-sm">
                            Event submitted! Redirecting...
                        </p>
                    )}

                    {duplicateId && (
                        <div className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                            <p className="font-semibold mb-1">This event already exists.</p>
                            <a href={`/events/${duplicateId}`} className="underline hover:text-yellow-900">
                                View existing event
                            </a>
                        </div>
                    )}

                    {error && (
                        <p className="mb-4 rounded-lg bg-red-100 p-3 text-red-700 text-sm">{error}</p>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text mb-1">
                                Event Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={form.title}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">
                                    Start Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="startdate"
                                    value={form.startdate}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">
                                    Start Time <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    name="starttime"
                                    value={form.starttime}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">
                                    End Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="enddate"
                                    value={form.enddate}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">
                                    End Time <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    name="endtime"
                                    value={form.endtime}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text mb-1">Venue</label>
                            <select
                                name="locationid"
                                value={form.locationid}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">— Select a venue —</option>
                                <option value="__new__">+ Add new venue</option>
                                {venues.map((v) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>

                        {isAddingNewVenue && (
                            <div className="grid grid-cols-1 gap-4 rounded-lg border border-default p-3">
                                <div>
                                    <label className="block text-sm font-medium text-text mb-1">
                                        New Venue Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="newVenueName"
                                        value={form.newVenueName}
                                        onChange={handleChange}
                                        required={isAddingNewVenue}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text mb-1">
                                        New Venue Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="newVenueAddress"
                                        value={form.newVenueAddress}
                                        onChange={handleChange}
                                        required={isAddingNewVenue}
                                        className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-text mb-1">Description</label>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                rows={3}
                                className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">Price ($)</label>
                                <input
                                    type="number"
                                    name="price"
                                    value={form.price}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    placeholder="0 = free"
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">Tickets / RSVP Link</label>
                                <input
                                    type="url"
                                    name="externallink"
                                    value={form.externallink}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text mb-1">Flyer Image URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    name="imageurl"
                                    value={form.imageurl}
                                    onChange={handleChange}
                                    className="min-w-0 flex-1 rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    ref={flyerInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={handleFlyerUpload}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => flyerInputRef.current?.click()}
                                    disabled={isUploadingFlyer}
                                    className="flex shrink-0 items-center justify-center rounded-lg border border-default px-3 text-text transition hover-bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Upload flyer image"
                                    title="Upload flyer image"
                                >
                                    <Upload className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text mb-1">Hosts</label>
                            <HostSelector
                                selectedHostIds={selectedHostIds}
                                onSelectedHostIdsChange={setSelectedHostIds}
                                maxHeightClassName="max-h-40"
                            />
                        </div>

                        <div className="rounded-xl border border-default bg-surface/40 p-4">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isRecurring}
                                    onChange={(e) => setIsRecurring(e.target.checked)}
                                    className="h-4 w-4 rounded border-default text-primary focus:ring-primary"
                                />
                                <div className="flex-1">
                                    <span className="font-semibold text-text text-sm flex items-center gap-2">
                                        <Repeat className="h-4 w-4 text-primary" />
                                        This is a recurring event
                                    </span>
                                    <p className="text-xs text-muted">
                                        Automatically generate repeat instances with matching title, image, hosts, and RSVP link
                                    </p>
                                </div>
                            </label>

                            {isRecurring && (
                                <div className="mt-4 pt-4 border-t border-default space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                                            Frequency
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { value: 'weekly', label: 'Weekly' },
                                                { value: 'biweekly', label: 'Biweekly' },
                                                { value: 'monthly', label: 'Monthly' },
                                            ].map((freq) => (
                                                <button
                                                    key={freq.value}
                                                    type="button"
                                                    onClick={() => setRecurrenceFrequency(freq.value as any)}
                                                    className={`rounded-lg py-2 px-3 text-xs font-semibold border transition ${
                                                        recurrenceFrequency === freq.value
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-default bg-bg text-muted hover:text-text'
                                                    }`}
                                                >
                                                    {freq.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {recurrenceFrequency !== 'monthly' ? (
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                                                Day of the Week
                                            </label>
                                            <select
                                                value={dayOfWeek}
                                                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                                                className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value={0}>Sunday</option>
                                                <option value={1}>Monday</option>
                                                <option value={2}>Tuesday</option>
                                                <option value={3}>Wednesday</option>
                                                <option value={4}>Thursday</option>
                                                <option value={5}>Friday</option>
                                                <option value={6}>Saturday</option>
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                                                Day of the Month
                                            </label>
                                            <select
                                                value={dayOfMonth}
                                                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                                                className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                                    <option key={d} value={d}>
                                                        {d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of each month
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                                            End Recurrence
                                        </label>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <button
                                                type="button"
                                                onClick={() => setEndType('instances')}
                                                className={`rounded-lg py-2 px-3 text-xs font-semibold border transition ${
                                                    endType === 'instances'
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-default bg-bg text-muted hover:text-text'
                                                }`}
                                            >
                                                Number of Instances
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEndType('duration')}
                                                className={`rounded-lg py-2 px-3 text-xs font-semibold border transition ${
                                                    endType === 'duration'
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-default bg-bg text-muted hover:text-text'
                                                }`}
                                            >
                                                Duration (Max 1 Year)
                                            </button>
                                        </div>

                                        {endType === 'instances' ? (
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min={2}
                                                        max={52}
                                                        value={instances}
                                                        onChange={(e) => setInstances(Math.min(52, Math.max(1, Number(e.target.value))))}
                                                        className="w-24 rounded-lg border border-default bg-bg px-3 py-1.5 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs text-muted">events total (2 to 52)</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={durationMonths}
                                                        onChange={(e) => setDurationMonths(Number(e.target.value))}
                                                        className="rounded-lg border border-default bg-bg px-3 py-1.5 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value={1}>1 month</option>
                                                        <option value={2}>2 months</option>
                                                        <option value={3}>3 months</option>
                                                        <option value={6}>6 months</option>
                                                        <option value={9}>9 months</option>
                                                        <option value={12}>1 year (12 months - max)</option>
                                                    </select>
                                                    <span className="text-xs text-muted">repeat until duration ends (max 1 year)</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-lg bg-bg/80 border border-default/60 p-2.5 text-xs text-muted flex items-start gap-2">
                                        <span className="font-semibold text-text">Summary:</span>
                                        <span>
                                            {getRecurrenceSummary({
                                                frequency: recurrenceFrequency,
                                                dayOfWeek: recurrenceFrequency !== 'monthly' ? dayOfWeek : undefined,
                                                dayOfMonth: recurrenceFrequency === 'monthly' ? dayOfMonth : undefined,
                                                endType,
                                                instances: endType === 'instances' ? Number(instances) || 1 : undefined,
                                                durationMonths: endType === 'duration' ? Number(durationMonths) || 1 : undefined,
                                            })}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-highlighted w-full rounded-lg py-2 font-semibold disabled:opacity-60"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Event'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};