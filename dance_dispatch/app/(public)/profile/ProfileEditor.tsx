'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';

type Props = {
  fullName: string;
  username: string;
  email: string;
  bio: string;
  genres: string[];
  genreOptions: string[];
  memberSince: string;
  usernameBadge: ReactNode;
};

export default function ProfileEditor(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(props.fullName);
  const [username, setUsername] = useState(props.username);
  const [email, setEmail] = useState(props.email);
  const [bio, setBio] = useState(props.bio);
  const [genres, setGenres] = useState(props.genres);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const options = [...new Set([...props.genreOptions, ...props.genres])].sort((a, b) => a.localeCompare(b));
  const selectedGenres = [...new Set(genres)].filter((genre) => options.includes(genre));
  const unselectedGenres = options.filter((genre) => !selectedGenres.includes(genre));

  function startEditing() {
    setFullName(props.fullName);
    setUsername(props.username);
    setEmail(props.email);
    setBio(props.bio);
    setGenres(props.genres);
    setError('');
    setMessage('');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError('');
    setFullName(props.fullName);
    setUsername(props.username);
    setEmail(props.email);
    setBio(props.bio);
    setGenres(props.genres);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, email, bio, genres }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.profileSaved) router.refresh();
        throw new Error(data.error || 'Unable to save profile.');
      }
      setMessage(data.emailPending
        ? 'Profile saved. Confirm the email change using the links sent by Supabase; your current email remains active until confirmation is complete.'
        : 'Profile saved.');
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 block w-full rounded border border-default bg-bg p-2 text-xl font-semibold text-text';

  return (
    <div>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-4">
            <label className="block space-y-1 text-sm text-text">
              Full Name
              {editing ? (
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} className={inputClass} />
              ) : (
                <span className="block text-xl font-semibold">{fullName || 'Not provided'}</span>
              )}
            </label>

            <label className="block space-y-1 text-sm text-text">
              Username
              {editing ? (
                <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} required className={inputClass} />
              ) : (
                <span className="flex items-center gap-2 text-xl font-semibold">
                  {username || 'Not provided'}
                  {props.usernameBadge}
                </span>
              )}
            </label>

            <label className="block space-y-1 text-sm text-text">
              Email
              {editing ? (
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required className={inputClass} />
              ) : (
                <span className="block break-words text-xl font-semibold">{email}</span>
              )}
            </label>

            <div className="space-y-1 text-sm text-text">
              <p>Member Since</p>
              <p className="text-xl font-semibold">{props.memberSince}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <button type="submit" disabled={saving} className="rounded border border-green-500 p-2 text-green-500 transition hover:bg-green-500 hover:text-white disabled:opacity-50" title="Save profile" aria-label="Save profile">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" onClick={cancelEditing} disabled={saving} className="rounded border border-red-500 p-2 text-red-500 transition hover:bg-red-500 hover:text-white" title="Cancel editing" aria-label="Cancel editing">
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button type="button" onClick={startEditing} className="rounded border border-default p-2 transition hover:border-accent" title="Edit profile" aria-label="Edit profile">
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {(bio || editing) && (
          <label className="block space-y-2 text-sm text-text">
            Bio
            {editing ? (
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={1000} rows={4} className="block w-full resize-y rounded border border-default bg-bg p-2 text-sm text-text" />
            ) : (
              <span className="block whitespace-pre-wrap text-sm text-text/80">{bio}</span>
            )}
          </label>
        )}

        {(genres.length > 0 || editing) && (
          <fieldset>
            <legend className="text-sm text-text">Favorite genres</legend>
            {editing ? (
              <>
                {options.length === 0 && <p className="mt-2 text-sm text-muted">No host genres available yet.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedGenres.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      aria-label={`Remove ${genre} from favorite genres`}
                      onClick={() => setGenres((current) => current.filter((item) => item !== genre))}
                      className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-text"
                    >
                      {genre}
                    </button>
                  ))}
                </div>
                {!!unselectedGenres.length && (
                  <div className="mt-3 flex max-h-40 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
                    {unselectedGenres.map((genre) => (
                      <label key={genre} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={false} onChange={() => setGenres((current) => [...current, genre])} />
                        {genre}
                      </label>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <span key={genre} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-text">{genre}</span>
                ))}
              </div>
            )}
          </fieldset>
        )}
      </form>

      {message && <p role="status" className="mt-3 text-sm text-text">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
