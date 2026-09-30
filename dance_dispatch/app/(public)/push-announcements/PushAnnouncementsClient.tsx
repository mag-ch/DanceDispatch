'use client';

import { useEffect, useRef, useState } from 'react';
import { BellRing, Send, X } from 'lucide-react';

type Mode = 'message' | 'review-request' | 'new-review' | 'new-event';
type AnnouncementEvent = { id: string; title: string; startdate: string; location?: string };
type AnnouncementReview = { id: string; eventName: string; username: string; userId: string; comment: string };
type UserResult = { id: string; username: string; full_name: string | null };

const modes: Array<{ id: Mode; label: string }> = [
  { id: 'message', label: 'Message' },
  { id: 'review-request', label: 'Review request' },
  { id: 'new-review', label: 'New review' },
  { id: 'new-event', label: 'New event' },
];

export default function PushAnnouncementsClient({ events, reviews }: { events: AnnouncementEvent[]; reviews: AnnouncementReview[] }) {
  const [mode, setMode] = useState<Mode>('message');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [eventId, setEventId] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [rsvpOnly, setRsvpOnly] = useState(false);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needsEvent = mode === 'review-request' || mode === 'new-event';
  const needsReview = mode === 'new-review';
  const selectedEvent = events.find((event) => event.id === eventId);
  const selectedReview = reviews.find((review) => review.id === reviewId);

  const filteredEvents = mode === "review-request" ? events.filter((event) => new Date(event.startdate) < new Date()).sort((a, b) => new Date(b.startdate).getTime() - new Date(a.startdate).getTime()) : events.filter((event) => new Date(event.startdate) >= new Date()).sort((a, b) => new Date(a.startdate).getTime() - new Date(b.startdate).getTime());

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmedQuery = userQuery.trim();
    if (trimmedQuery.length < 2) {
      setUserResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const response = await fetch(`/api/share/users?query=${encodeURIComponent(trimmedQuery)}`);
        const data = await response.json().catch(() => []);
        setUserResults(Array.isArray(data) ? data : []);
      } catch {
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [userQuery]);

  const addUser = (candidate: UserResult) => {
    setSelectedUsers((current) => (current.some((u) => u.id === candidate.id) ? current : [...current, candidate]));
    setUserQuery('');
    setUserResults([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((current) => current.filter((u) => u.id !== userId));
  };

  const sendAnnouncement = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/push-notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title,
          message,
          eventId,
          reviewId,
          userIds: selectedUsers.map((u) => u.id),
          rsvpOnly,
          followersOnly,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? 'Could not send announcement.');

      setResult(`Sent to ${payload.notified} users across ${payload.sent} devices. ${payload.removed} expired subscriptions removed.`);
      setTitle('');
      setMessage('');
      setSelectedUsers([]);
      setConfirming(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send announcement.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl py-6 sm:py-10">
      <div className="flex items-center gap-3 border-b border-default pb-5">
        <BellRing className="h-6 w-6 text-accent" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-text">Push announcements</h1>
          <p className="mt-1 text-sm text-muted">Send to all users with an active push subscription.</p>
        </div>
      </div>

      <div className="mt-6">
        <div role="tablist" aria-label="Announcement type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              onClick={() => { setMode(item.id); setConfirming(false); setError(null); setResult(null); }}
              className={`min-h-10 rounded border px-3 py-2 text-sm font-semibold transition ${mode === item.id ? 'border-accent bg-accent text-text' : 'border-default bg-surface text-text hover:border-accent'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {needsEvent && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text">Event</span>
                <select
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  className="w-full rounded border border-default bg-surface px-3 py-2.5 text-text"
                >
                  <option value="">Choose an event</option>
                  {filteredEvents.map((event) => (
                    <option key={event.id} value={event.id}>{event.title} · {event.startdate}</option>
                  ))}
                </select>
              </label>

              {mode === 'review-request' && (
                <label className="flex items-center gap-2 text-sm font-semibold text-text">
                  <input type="checkbox" checked={rsvpOnly} onChange={(event) => setRsvpOnly(event.target.checked)} className="h-4 w-4 rounded border-default" />
                  Only send to users who RSVP'ed to this event
                </label>
              )}
            </>
          )}

          {needsReview && (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text">Review</span>
                <select
                  value={reviewId}
                  onChange={(event) => setReviewId(event.target.value)}
                  className="w-full rounded border border-default bg-surface px-3 py-2.5 text-text"
                >
                  <option value="">Choose a review</option>
                  {reviews.map((review) => (
                    <option key={review.id} value={review.id}>
                      {review.username} · {review.eventName}{review.comment ? ` — ${review.comment.slice(0, 40)}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-text">
                <input type="checkbox" checked={followersOnly} onChange={(event) => setFollowersOnly(event.target.checked)} className="h-4 w-4 rounded border-default" />
                Only users that follow the review poster
              </label>
            </>
          )}

          {mode === 'message' && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-text">Title</span>
                  <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} className="w-full rounded border border-default bg-surface px-3 py-2.5 text-text" placeholder="Announcement title" />
                  <span className="text-right text-xs text-muted">{title.length}/80</span>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-text">Message</span>
                  <textarea value={message} maxLength={240} rows={3} onChange={(event) => setMessage(event.target.value)} className="w-full resize-y rounded border border-default bg-surface px-3 py-2.5 text-text" placeholder="Write a short announcement" />
                  <span className="text-right text-xs text-muted">{message.length}/240</span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text">Recipients</span>
                <p className="text-xs text-muted">Leave empty to send to all subscribed users, or search usernames to target specific people.</p>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((selected) => (
                      <span key={selected.id} className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-3 py-1 text-sm text-text">
                        {selected.username}
                        <button type="button" onClick={() => removeUser(selected.id)} aria-label={`Remove ${selected.username}`} className="text-muted hover:text-text">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    className="w-full rounded border border-default bg-surface px-3 py-2.5 text-text"
                    placeholder="Search by username"
                  />
                  {(searchingUsers || userResults.length > 0) && userQuery.trim().length >= 2 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded border border-default bg-surface shadow-lg">
                      {searchingUsers && <li className="px-3 py-2 text-sm text-muted">Searching...</li>}
                      {!searchingUsers && userResults.length === 0 && <li className="px-3 py-2 text-sm text-muted">No users found</li>}
                      {!searchingUsers && userResults.map((candidate) => (
                        <li key={candidate.id}>
                          <button type="button" onClick={() => addUser(candidate)} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/10">
                            <span className="font-semibold text-text">{candidate.username}</span>
                            {candidate.full_name && <span className="text-xs text-muted">{candidate.full_name}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}

            {mode === 'new-event' && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-text">Message</span>
                  <textarea value={message} maxLength={240} rows={3} onChange={(event) => message ? setMessage(event.target.value) : null} className="w-full resize-y rounded border border-default bg-surface px-3 py-2.5 text-text" placeholder="Write a short announcement" />
                  <span className="text-right text-xs text-muted">{message.length}/240</span>
                </label>
              </div>
            </>
          )}

          {selectedEvent && needsEvent && (
            <p className="border-l-2 border-accent pl-3 text-sm text-muted">
              {mode === 'review-request' && 'Recipients will be taken directly to the review form.'}
              {mode === 'new-event' && 'Recipients will be taken to this event.'}
            </p>
          )}

          {selectedReview && needsReview && (
            <p className="border-l-2 border-accent pl-3 text-sm text-muted">Recipients will be taken to this event to read the new review.</p>
          )}

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          {result && <p role="status" className="text-sm text-emerald-600">{result}</p>}

          {confirming ? (
            <div className="flex flex-col gap-3 border-t border-default pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-text">
                {mode === 'message' && selectedUsers.length > 0
                  ? `Send this push announcement to ${selectedUsers.length} selected user${selectedUsers.length === 1 ? '' : 's'}?`
                  : mode === 'review-request' && rsvpOnly
                    ? "Send this push announcement to users who RSVP'ed to this event?"
                    : mode === 'new-review' && followersOnly
                      ? 'Send this push announcement to followers of the review poster?'
                      : 'Send this push announcement to all subscribed users?'}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="rounded border border-default px-4 py-2 text-sm font-semibold text-text">Cancel</button>
                <button type="button" onClick={() => void sendAnnouncement()} disabled={sending} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-text disabled:opacity-60">
                  <Send className="h-4 w-4" />{sending ? 'Sending...' : 'Confirm send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-default pt-5">
              <button
                type="button"
                onClick={() => { setError(null); setResult(null); setConfirming(true); }}
                disabled={needsEvent ? !eventId : needsReview ? !reviewId : !title.trim() || !message.trim()}
                className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-semibold text-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />Review and send
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}