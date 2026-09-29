import Link from 'next/link';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type ConfirmPageProps = {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
    admin_invite?: string;
  }>;
};

const OTP_TYPES: ReadonlySet<EmailOtpType> = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email',
  'email_change',
]);

function getSafeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }

  if (next.startsWith('/auth/')) {
    return '/';
  }

  return next;
}

export default async function ConfirmEmailPage({ searchParams }: ConfirmPageProps) {
  const { token_hash: tokenHash, type, next, admin_invite: adminInvite } = await searchParams;
  const nextPath = getSafeNextPath(next);

  if (!tokenHash || !type || !OTP_TYPES.has(type as EmailOtpType)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-text">Invalid confirmation link</h1>
          <p className="mt-3 text-sm text-text/70">
            The verification link is missing required information or has been malformed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/auth/signup" className="rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg">
              Back to sign up
            </Link>
            <Link href="/auth/login" className="rounded-full border border-text/15 px-5 py-2 text-sm font-semibold text-text">
              Go to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (!error) {
    let inviteError: string | null = null;
    if (adminInvite) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;
      if (userError || !user) {
        inviteError = 'Your email is confirmed, but we could not verify your account to apply the admin invite.';
      } else {
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: user.id,
            full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '',
            username: typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : '',
            email: user.email ?? '',
          },
          { onConflict: 'id' }
        );

        if (profileError) {
          inviteError = 'Your email is confirmed, but we could not finish setting up your profile.';
        }
      }

      if (!inviteError) {
      const { data: inviteRedeemed, error: redeemError } = await supabase.rpc('redeem_admin_invite_code', {
        p_code: adminInvite.trim().toUpperCase(),
      });
      if (redeemError || !inviteRedeemed) {
        inviteError = 'Your email is confirmed, but this admin invite could not be redeemed. Sign in and open the invite link again.';
      }
      }
    }

    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Email confirmed</p>
          <h1 className="mt-3 text-3xl font-semibold text-text">Your account is ready</h1>
          <p className="mt-3 text-sm leading-6 text-text/70">
            Your email address has been verified successfully. You can continue into DanceDispatch now.
          </p>
          {inviteError && <p className="mt-3 text-sm text-red-600">{inviteError}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={nextPath} className="rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg">
              Continue
            </Link>
            <Link href="/auth/login" className="rounded-full border border-text/15 px-5 py-2 text-sm font-semibold text-text">
              Login instead
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const message = error.message.toLowerCase().includes('expired')
    ? 'This verification link has expired. Request a new confirmation email and try again.'
    : 'We could not verify your email with this link. It may already have been used or is no longer valid.';

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Confirmation failed</p>
        <h1 className="mt-3 text-3xl font-semibold text-text">That link didn&apos;t work</h1>
        <p className="mt-3 text-sm leading-6 text-text/70">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/auth/signup" className="rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg">
            Back to sign up
          </Link>
          <Link href="/auth/login" className="rounded-full border border-text/15 px-5 py-2 text-sm font-semibold text-text">
            Go to login
          </Link>
        </div>
      </div>
    </main>
  );
}