'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { PartyPlanEvent } from '@/lib/party-plan';
import CopyShareButton from '../party-plan/[planId]/CopyShareButton';

type MakePartyPlanButtonProps = {
  upcomingEvents: PartyPlanEvent[];
};

export type SavedPlan = {
  id: number;
  name: string;
  username: string;
  planKey: string;
  eventIds: number[];
  summary: {
    partyCount: number;
    dateRangeLabel: string;
    totalPrice: number;
    locationFlow: string;
  };
  events: Array<Event>;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function formatEventDate(startdate?: string | null, starttime?: string | null): string {
  const date = String(startdate ?? '').trim();
  if (!date) return 'Date TBD';

  const time = String(starttime ?? '').trim();
  const candidate = new Date(`${date}T${time || '00:00:00'}`);
  if (Number.isNaN(candidate.getTime())) {
    return date;
  }

  return candidate.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function defaultPlanNameFromFirstEvent(events: PartyPlanEvent[]): string {
  if (events.length === 0) {
    return 'Party Plan';
  }

  const firstEvent = events[0];
  const date = String(firstEvent.startdate ?? '').trim();
  if (!date) {
    return 'Party Plan';
  }

  const time = String(firstEvent.starttime ?? '').trim() || '00:00:00';
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) {
    return 'Party Plan';
  }

  const formatted = parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `Party Plan - ${formatted}`;
}

export default function MakePartyPlanButton({ upcomingEvents }: MakePartyPlanButtonProps) {
  const [activeView, setActiveView] = useState<'plans' | 'builder' | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planName, setPlanName] = useState('');
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dragOverEventId, setDragOverEventId] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isDeletingPlanId, setIsDeletingPlanId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasEvents = upcomingEvents.length > 0;

  const upcomingEventById = useMemo(
    () => new Map(upcomingEvents.map((event) => [String(event.id), event])),
    [upcomingEvents],
  );

  const selectedEvents = useMemo(
    () =>
      selectedEventIds
        .map((eventId) => upcomingEventById.get(eventId))
        .filter((event): event is PartyPlanEvent => Boolean(event)),
    [selectedEventIds, upcomingEventById],
  );

  const suggestedPlanName = useMemo(() => defaultPlanNameFromFirstEvent(selectedEvents), [selectedEvents]);

  const toShareUrl = (planId: number) => {
    return `${window.location.origin}/party-plan/${planId}`;
  };

  const openPlanInNewTab = (planId: number) => {
    window.open(toShareUrl(planId), '_blank', 'noopener,noreferrer');
  };

  const closeAll = () => {
    setActiveView(null);
    setError(null);
    setFeedback(null);
    setDraggedEventId(null);
    setDragOverEventId(null);
  };

  const loadPlans = async () => {
    try {
      setIsLoadingPlans(true);
      setError(null);
      const response = await fetch('/api/user-plans', { method: 'GET' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load your plans.');
      }

      setSavedPlans(Array.isArray(payload?.plans) ? payload.plans : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load your plans.');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const openPlans = async () => {
    setActiveView('plans');
    setError(null);
    setFeedback(null);
    await loadPlans();
  };

  const openBuilderForNewPlan = () => {
    setSelectedEventIds([]);
    setEditingPlanId(null);
    setPlanName('');
    setDraggedEventId(null);
    setDragOverEventId(null);
    setShareUrl(null);
    setError(null);
    setFeedback(null);
    setActiveView('builder');
  };

  const openBuilderForEdit = (planId: number, eventIds: number[], existingName: string) => {
    setSelectedEventIds(eventIds.map((value) => String(value)));
    setEditingPlanId(planId);
    setPlanName(existingName || '');
    setDraggedEventId(null);
    setDragOverEventId(null);
    setShareUrl(toShareUrl(planId));
    setError(null);
    setFeedback(null);
    setActiveView('builder');
  };

  const deletePlan = async (planId: number) => {
    if (!planId) return;

    try {
      setIsDeletingPlanId(planId);
      setError(null);
      setFeedback(null);

      const response = await fetch(`/api/user-plans/${planId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to delete plan.');
      }

      setSavedPlans((current) => current.filter((plan) => plan.id !== planId));
      setFeedback('Plan deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete plan.');
    } finally {
      setIsDeletingPlanId(null);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId],
    );
  };

  const selectAll = () => {
    setSelectedEventIds(upcomingEvents.map((event) => String(event.id)));
  };

  const clearSelection = () => {
    setSelectedEventIds([]);
    setEditingPlanId(null);
    setPlanName('');
    setDraggedEventId(null);
    setDragOverEventId(null);
    setShareUrl(null);
    setFeedback(null);
  };

  const handleDragStart = (eventId: string) => {
    setDraggedEventId(eventId);
  };

  const handleDragOver = (eventId: string) => {
    setDragOverEventId(eventId);
  };

  const handleDrop = (targetEventId: string) => {
    if (!draggedEventId || draggedEventId === targetEventId) {
      setDraggedEventId(null);
      setDragOverEventId(null);
      return;
    }

    setSelectedEventIds((current) => {
      const sourceIndex = current.indexOf(draggedEventId);
      const targetIndex = current.indexOf(targetEventId);
      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      const reordered = [...current];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });

    setDraggedEventId(null);
    setDragOverEventId(null);
  };

  const savePlan = async () => {
    if (selectedEventIds.length === 0) {
      setError('Select at least one party.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setFeedback(null);

      const eventIds = selectedEventIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
      const resolvedPlanName = planName.trim() || suggestedPlanName;

      const method = editingPlanId ? 'PATCH' : 'POST';
      const response = await fetch('/api/user-plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingPlanId
            ? { planId: editingPlanId, eventIds, planName: resolvedPlanName }
            : { eventIds, planName: resolvedPlanName },
        ),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to save party plan.');
      }

      setShareUrl(toShareUrl(payload?.planId));
      setFeedback(editingPlanId ? 'Party plan updated. Share this URL with friends.' : 'Party plan saved. Share this URL with friends.');
      if (payload?.planId) {
        setEditingPlanId(Number(payload.planId));
      }
      if (payload?.planName) {
        setPlanName(String(payload.planName));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save party plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setFeedback('Share URL copied to clipboard.');
    } catch {
      setFeedback('Copy failed. You can manually copy the URL.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void openPlans();
        }}
        className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold"
      >
        Make a Party Plan
      </button>

      {activeView === 'plans' && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={closeAll}
        >
          <div
            className="w-full max-w-[900px] max-h-[85vh] overflow-y-auto rounded-2xl border border-default bg-surface p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Your saved party plans"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Party Plan</p>
                <h3 className="mt-1 text-2xl font-bold text-text">Your Plans</h3>
                <p className="mt-1 text-sm text-muted">Manage previous plans or create a new one.</p>
              </div>
              <button
                type="button"
                onClick={closeAll}
                className="rounded-full p-2 text-muted transition hover:bg-accent"
                aria-label="Close party plans"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={openBuilderForNewPlan}
                className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                disabled={!hasEvents}
                title={hasEvents ? 'Create a new plan' : 'No upcoming RSVPs available'}
              >
                New Plan
              </button>
            </div>

            {isLoadingPlans ? (
              <p className="text-sm text-muted">Loading plans...</p>
            ) : savedPlans.length === 0 ? (
              <p className="text-sm text-muted">No saved plans yet.</p>
            ) : (
              <div className="space-y-3">
                {savedPlans.map((plan, index) => {
                  const shareUrlForPlan = toShareUrl(plan.id);
                  const isDeleting = isDeletingPlanId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className="cursor-pointer rounded-xl border border-default p-4 transition hover:bg-accent-soft"
                      onClick={() => openPlanInNewTab(plan.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openPlanInNewTab(plan.id);
                        }
                      }}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ${plan.name || `Plan ${index + 1}`} in a new tab`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text">{plan.name || `Plan ${index + 1}`}</p>
                          <p className="mt-1 text-xs text-muted">
                            {plan.summary.partyCount} parties • {plan.summary.dateRangeLabel}
                          </p>
                          <p className="mt-1 text-xs text-muted">Total: {currencyFormatter.format(plan.summary.totalPrice)}</p>
                          <p className="mt-1 text-xs text-muted line-clamp-2">Flow: {plan.summary.locationFlow}</p>
                        </div>

                        <div
                          className="flex flex-wrap gap-2"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openBuilderForEdit(plan.id, plan.eventIds, plan.name)}
                            className="rounded border border-default px-3 py-1.5 text-xs font-semibold text-text hover:bg-accent-soft"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void deletePlan(plan.id);
                            }}
                            className="rounded border border-default px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                            disabled={isDeleting}
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                          <CopyShareButton shareUrl={shareUrlForPlan} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
            {feedback && <p className="mt-4 text-sm text-green-600">{feedback}</p>}
          </div>
        </div>
      )}

      {activeView === 'builder' && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={closeAll}
        >
          <div
            className="w-full max-w-[900px] max-h-[85vh] overflow-y-auto rounded-2xl border border-default bg-surface p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Build and share party plan"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Party Plan</p>
                <h3 className="mt-1 text-2xl font-bold text-text">{editingPlanId ? 'Edit your lineup' : 'Build your lineup'}</h3>
                <p className="mt-1 text-sm text-muted">Select one or multiple upcoming RSVPs and share your plan via URL.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setFeedback(null);
                    setActiveView('plans');
                    void loadPlans();
                  }}
                  className="rounded-lg border border-default px-3 py-1.5 text-xs font-semibold text-text hover:bg-accent-soft"
                >
                  Back to Plans
                </button>
                <button
                  type="button"
                  onClick={closeAll}
                  className="rounded-full p-2 text-muted transition hover:bg-accent"
                  aria-label="Close party plan builder"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
              <div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted">Plan Name</label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder={suggestedPlanName}
                    className="w-full rounded-lg border border-default bg-bg px-3 py-2 text-sm text-text outline-none"
                  />
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-text">Upcoming RSVPs</p>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="rounded border border-default px-2 py-1 text-text hover:bg-accent-soft"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="rounded border border-default px-2 py-1 text-text hover:bg-accent-soft"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted">No upcoming RSVPs yet.</p>
                ) : (
                  <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                    {upcomingEvents.map((event) => {
                      const eventId = String(event.id);
                      const selected = selectedEventIds.includes(eventId);

                      return (
                        <label
                          key={eventId}
                          className={`block cursor-pointer rounded-lg border p-3 transition ${
                            selected ? 'border-cyan-400 bg-cyan-50/40 dark:bg-cyan-500/10' : 'border-default hover:bg-accent-soft'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleEvent(eventId)}
                              className="mt-1 h-4 w-4"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text">{event.title}</p>
                              <p className="text-xs text-muted">{formatEventDate(event.startdate, event.starttime)}</p>
                              <p className="truncate text-xs text-muted">{event.location || 'Location TBD'}</p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-cyan-300/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-4 dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10">
                {selectedEvents.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Selected Order (Drag to Reorder)</p>
                    <div className="max-h-[24vh] space-y-2 overflow-y-auto pr-1">
                      {selectedEvents.map((event, index) => {
                        const eventId = String(event.id);
                        const isDragTarget = dragOverEventId === eventId;

                        return (
                          <div
                            key={eventId}
                            draggable
                            onDragStart={() => handleDragStart(eventId)}
                            onDragOver={(dragEvent) => {
                              dragEvent.preventDefault();
                              handleDragOver(eventId);
                            }}
                            onDrop={(dragEvent) => {
                              dragEvent.preventDefault();
                              handleDrop(eventId);
                            }}
                            onDragEnd={() => {
                              setDraggedEventId(null);
                              setDragOverEventId(null);
                            }}
                            className={`cursor-grab rounded-lg border bg-bg px-3 py-2 text-xs transition active:cursor-grabbing ${
                              isDragTarget ? 'border-cyan-400 ring-1 ring-cyan-300' : 'border-default'
                            }`}
                          >
                            <p className="font-semibold text-text">{index + 1}. {event.title}</p>
                            <p className="mt-1 text-muted">{formatEventDate(event.startdate, event.starttime)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={savePlan}
                    disabled={isSaving || selectedEventIds.length === 0}
                    className="btn-highlighted w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {isSaving ? 'Saving Plan...' : editingPlanId ? 'Update & Generate Share URL' : 'Save & Generate Share URL'}
                  </button>

                  {shareUrl && (
                    <>
                      <button
                        type="button"
                        onClick={copyShareUrl}
                        className="w-full rounded-lg border border-default px-4 py-2 text-sm font-semibold text-text hover:bg-accent-soft"
                      >
                        Copy Share URL
                      </button>
                      <Link
                        href={shareUrl}
                        className="block rounded-lg border border-default px-4 py-2 text-center text-sm font-semibold text-text hover:bg-accent-soft"
                        target="_blank"
                      >
                        Open Shared Plan
                      </Link>
                    </>
                  )}
                </div>

                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                {feedback && <p className="mt-3 text-sm text-green-600">{feedback}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
