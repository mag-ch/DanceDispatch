'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AuthRequiredModal } from '@/app/components/AuthRequiredModal';
import { useAuth } from '@/app/providers/AuthContext';
import { Venue } from '@/lib/utils';

interface SubmitEventModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FormState {
    title: string;
    startdate: string;
    starttime: string;
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
    endtime: '',
    locationid: '',
    newVenueName: '',
    newVenueAddress: '',
    description: '',
    price: '',
    imageurl: '',
    externallink: '',
};

export const SubmitEventModal: React.FC<SubmitEventModalProps> = ({ isOpen, onClose }) => {
    const { session, loading: authLoading } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [form, setForm] = useState<FormState>(empty);
    const [venues, setVenues] = useState<Venue[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateId, setDuplicateId] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const isAddingNewVenue = form.locationid === '__new__';

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
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
        setError(null);
        setDuplicateId(null);
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
            <div className="relative w-full max-w-lg rounded-xl bg-bg shadow-xl dark:bg-surface max-h-[90vh] overflow-y-auto">
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
                                    Date <span className="text-red-500">*</span>
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

                        <div>
                            <div>
                                <label className="block text-sm font-medium text-text mb-1">
                                    Date <span className="text-red-500">*</span>
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
                                <label className="block text-sm font-medium text-text mb-1">Flyer Image URL</label>
                                <input
                                    type="url"
                                    name="imageurl"
                                    value={form.imageurl}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
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
