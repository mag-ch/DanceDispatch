'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type User = { id: string; name: string; isFollowing?: boolean };
type Tab = 'followers' | 'blocked';

export default function BlockedUsers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openFollowersFromNotification = searchParams.get('manage') === 'followers';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabsRef = useRef<Record<Tab, HTMLButtonElement | null>>({ followers: null, blocked: null });
  const requestRef = useRef<AbortController | null>(null);
  const [tab, setTab] = useState<Tab>('followers');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => () => requestRef.current?.abort(), []);

  const load = useCallback(async (nextTab: Tab) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setTab(nextTab);
    setUsers([]);
    setConfirmingRemovalId(null);
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const path = nextTab === 'followers' ? '/api/users/followers' : '/api/users/blocks';
      const response = await fetch(path, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Failed to load ${nextTab}`);
      const data: { users: User[] } = await response.json();
      if (!controller.signal.aborted) setUsers(data.users);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(`Failed to load ${nextTab}:`, err);
        setError(`Unable to load ${nextTab === 'followers' ? 'followers' : 'blocked users'}. Please try again.`);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!openFollowersFromNotification) return;
    dialogRef.current?.showModal();
    void load('followers');
  }, [load, openFollowersFromNotification]);

  function open() {
    dialogRef.current?.showModal();
    void load('followers');
  }

  function close() {
    requestRef.current?.abort();
    dialogRef.current?.close();
  }

  async function update(user: User, action: 'follow' | 'unfollow' | 'remove' | 'block' | 'unblock') {
    if (pending) return;
    setPending(user.id);
    setError('');
    setMessage('');
    try {
      const isFollowAction = action === 'follow' || action === 'unfollow';
      const endpoint = isFollowAction ? 'saved-users' : action === 'remove' ? 'followers' : 'blocks';
      const response = await fetch(`/api/users/${endpoint}/${encodeURIComponent(user.id)}`, {
        method: action === 'follow' || action === 'block' ? 'POST' : 'DELETE',
        ...(isFollowAction ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveToggle: action === 'follow' }),
        } : {}),
      });
      if (!response.ok) throw new Error(`Failed to ${action} user`);
      if (isFollowAction) {
        setUsers((current) => current.map((entry) => entry.id === user.id
          ? { ...entry, isFollowing: action === 'follow' }
          : entry));
        setMessage(action === 'follow' ? `Following ${user.name}.` : `Unfollowed ${user.name}.`);
      } else if (action === 'unblock') {
        setUsers((current) => current.filter((entry) => entry.id !== user.id));
        setMessage('User unblocked.');
      } else {
        setUsers((current) => current.filter((entry) => entry.id !== user.id));
        setConfirmingRemovalId(null);
        setMessage(action === 'remove' ? 'Follower removed.' : 'User blocked.');
      }
      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action} user:`, err);
      setError(`Unable to ${action} user. Please try again.`);
    } finally {
      setPending(null);
    }
  }

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'followers' : event.key === 'End' ? 'blocked' : tab === 'followers' ? 'blocked' : 'followers';
    tabsRef.current[next]?.focus();
    void load(next);
  }

  return (
    <section className="mb-8">
      <button type="button" onClick={open} className="btn-highlighted rounded-lg px-4 py-2 text-sm font-semibold">
        Manage Followers and Blocked Users
      </button>
      <dialog ref={dialogRef} onClose={() => requestRef.current?.abort()}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        aria-labelledby="manage-users-title"
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg bg-surface p-6 text-text shadow-xl backdrop:bg-black/50">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="manage-users-title" className="text-xl font-semibold">Manage Followers and Blocked Users</h2>
          <button type="button" onClick={close} disabled={pending !== null} aria-label="Close" className="px-2 text-2xl hover:opacity-70 disabled:opacity-50">&times;</button>
        </div>
        <div role="tablist" aria-label="Manage users" className="mb-4 flex gap-2 border-b border-default">
          {(['followers', 'blocked'] as const).map((item) => (
            <button key={item} ref={(element) => { tabsRef.current[item] = element; }}
              type="button" role="tab" id={`manage-${item}-tab`} aria-selected={tab === item}
              aria-controls="manage-users-panel" tabIndex={tab === item ? 0 : -1}
              disabled={pending !== null}
              onClick={() => { if (item !== tab) void load(item); }}
              onKeyDown={onTabKeyDown}
              className={`border-b-2 px-3 py-2 text-sm font-semibold disabled:opacity-50 ${tab === item ? 'border-accent text-text' : 'border-transparent text-muted'}`}>
              {item === 'followers' ? 'Followers' : 'Blocked Users'}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="manage-users-panel" aria-labelledby={`manage-${tab}-tab`} tabIndex={0}>
          <p className="mb-4 text-sm text-muted">
            {tab === 'followers'
              ? 'Removed followers can follow you again unless you block them.'
              : 'Blocked users cannot see your profile or activity while signed in. Unblocking does not restore follows.'}
          </p>
          {loading ? <p className="text-sm text-muted">Loading...</p> : users.length > 0 ? (
            <ul className="space-y-3">
              {users.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/users/${encodeURIComponent(user.id)}`} className="text-text hover:underline">{user.name}</Link>
                  {tab === 'followers' ? confirmingRemovalId === user.id ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Block this user as well?</span>
                      <button type="button" disabled={pending !== null}
                        onClick={() => void update(user, 'block')}
                        className="rounded border border-default px-3 py-1 hover:border-accent disabled:opacity-50">
                        {pending === user.id ? 'Working...' : 'Yes'}
                      </button>
                      <button type="button" disabled={pending !== null}
                        onClick={() => void update(user, 'remove')}
                        className="rounded border border-default px-3 py-1 hover:border-accent disabled:opacity-50">
                        {pending === user.id ? 'Working...' : 'No'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" disabled={pending !== null}
                        onClick={() => void update(user, user.isFollowing ? 'unfollow' : 'follow')}
                        className="rounded border border-default px-3 py-1 text-sm hover:border-accent disabled:opacity-50">
                        {pending === user.id ? 'Working...' : user.isFollowing ? 'Unfollow' : 'Follow'}
                      </button>
                      <button type="button" disabled={pending !== null}
                        onClick={() => { setError(''); setConfirmingRemovalId(user.id); }}
                        className="rounded border border-default px-3 py-1 text-sm hover:border-accent disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={pending !== null}
                      onClick={() => void update(user, 'unblock')}
                      className="rounded border border-default px-3 py-1 text-sm hover:border-accent disabled:opacity-50">
                      {pending === user.id ? 'Working...' : 'Unblock'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : !error && <p className="text-sm text-muted">{tab === 'followers' ? 'No followers yet.' : 'No blocked users.'}</p>}
          {error && <div role="alert" className="mt-3 text-sm text-red-500">{error} <button type="button" onClick={() => void load(tab)} className="underline">Reload</button></div>}
          {message && <p role="status" className="mt-3 text-sm text-text">{message}</p>}
        </div>
      </dialog>
    </section>
  );
}
