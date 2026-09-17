'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';

interface InviteClientProps {
    code: string;
    isValid: boolean;
}

export default function InviteClient({ code, isValid }: InviteClientProps) {
    const { session, loading } = useAuth();
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [redeemed, setRedeemed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isValid) {
        return (
            <main className="flex min-h-screen items-center justify-center px-4 py-12">
                <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-2xl font-semibold text-text">This code is no longer valid</h1>
                    <p className="mt-3 text-sm text-text/70">
                        This admin invite link has already reached its usage limit or has been revoked.
                    </p>
                    <Link href="/auth/signup" className="mt-6 inline-block rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg">
                        Sign up without an invite
                    </Link>
                </div>
            </main>
        );
    }

    const redeemInvite = async () => {
        setIsRedeeming(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/invite-code/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to accept invite');
            }

            setRedeemed(true);
        } catch (redeemError) {
            setError(redeemError instanceof Error ? redeemError.message : 'Failed to accept invite');
        } finally {
            setIsRedeeming(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
            <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
                <h1 className="text-2xl font-semibold text-text">You're invited to be an admin</h1>
                {loading ? (
                    <p className="mt-3 text-sm text-text/70">Checking your account...</p>
                ) : session ? (
                    <>
                        <p className="mt-3 text-sm text-text/70">
                            Continue as <strong>{session.user.email ?? 'your signed-in account'}</strong>?
                        </p>
                        {redeemed ? (
                            <>
                                <p className="mt-4 text-sm font-semibold text-emerald-700">Admin access added to your account.</p>
                                <Link href="/profile" className="mt-6 inline-block rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg">
                                    Go to profile
                                </Link>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void redeemInvite()}
                                disabled={isRedeeming}
                                className="mt-6 rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50"
                            >
                                {isRedeeming ? 'Adding admin access...' : 'Confirm this account'}
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <p className="mt-3 text-sm text-text/70">
                            Sign up using this link to receive admin access on DanceDispatch.
                        </p>
                        <Link
                            href={`/auth/signup?admin_invite=${encodeURIComponent(code)}`}
                            className="mt-6 inline-block rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg"
                        >
                            Continue to sign up
                        </Link>
                    </>
                )}
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            </div>
        </main>
    );
}
