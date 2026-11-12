import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid profile.' }, { status: 400 });
  const values = body as Record<string, unknown>;
  if (typeof values.fullName !== 'string' || typeof values.username !== 'string' ||
      typeof values.email !== 'string' || typeof values.bio !== 'string' ||
      !Array.isArray(values.genres) || !values.genres.every((genre: unknown) => typeof genre === 'string')) {
    return NextResponse.json({ error: 'Invalid profile fields.' }, { status: 400 });
  }
  const fullName = values.fullName.trim();
  const username = values.username.trim();
  const email = values.email.trim().toLowerCase();
  const bio = values.bio.trim();
  const genres: string[] = values.genres;
  if (!username || username.length > 50 || fullName.length > 100 || bio.length > 1000 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      genres.length > 50 || new Set(genres).size !== genres.length) {
    return NextResponse.json({ error: 'Check the profile fields and try again.' }, { status: 400 });
  }

  const emailChanged = email !== user.email?.toLowerCase();
  const [{ data: hosts, error: hostsError }, { data: current, error: profileError }] = await Promise.all([
    supabase.from('Hosts').select('genres'),
    supabase.from('profiles').select('genres').eq('id', user.id).single(),
  ]);
  if (hostsError || profileError) {
    console.error('Unable to load profile options:', hostsError ?? profileError);
    return NextResponse.json({ error: 'Unable to load profile options.' }, { status: 500 });
  }
  const allowed = new Set<string>([
    ...(current.genres ?? []),
    ...(hosts ?? []).flatMap((host: { genres: string[] | null }) => host.genres ?? []),
  ]);
  if (genres.some((genre) => !allowed.has(genre))) {
    return NextResponse.json({ error: 'Select genres from the available options.' }, { status: 400 });
  }
  if (emailChanged) {
    const { data: available, error } = await supabase.rpc('profile_email_available', { candidate: email });
    if (error) {
      console.error('Unable to check email availability:', error);
      return NextResponse.json({ error: 'Unable to check email availability.' }, { status: 500 });
    }
    if (!available) return NextResponse.json({ error: 'That email is already in use.' }, { status: 409 });
  }

  const { error: updateError } = await supabase.from('profiles')
    .update({ full_name: fullName || null, username, bio: bio || null, genres })
    .eq('id', user.id);
  if (updateError) {
    if (updateError.code === '23505') {
      return NextResponse.json({ error: 'That username is already in use.' }, { status: 409 });
    }
    console.error('Unable to update profile:', updateError);
    return NextResponse.json({ error: 'Unable to save profile.' }, { status: 500 });
  }

  if (emailChanged) {
    const redirect = new URL('/auth/confirm?next=%2Fprofile', request.url).toString();
    const { data, error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirect });
    if (error) {
      console.error('Unable to request email change:', error);
      return NextResponse.json({ error: `Profile saved, but email change failed: ${error.message}`, profileSaved: true }, { status: 400 });
    }
    return NextResponse.json({ emailPending: data.user?.email?.toLowerCase() !== email });
  }
  return NextResponse.json({ emailPending: false });
}
