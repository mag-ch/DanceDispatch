'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';

interface InviteCodeData {
    code: string;
    max_uses: number;
    uses_count: number;
    revoked: boolean;
}

export default function AdminInviteCodePanel() {
    const { loading: authLoading, isAdmin } = useAuth();
    const [invite, setInvite] = useState<InviteCodeData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (authLoading || !isAdmin) {
            return;
        }

        let isMounted = true;
        fetch('/api/admin/invite-code')
            .then(async (response) => {
                const data = await response.json().catch(() => null);
                if (!response.ok || data?.error) {
                    throw new Error(data?.error ?? 'Failed to load invite code');
                }
                return data as InviteCodeData;
            })
            .then((data) => {
                if (isMounted) setInvite(data);
            })
            .catch((loadError) => {
                if (isMounted) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load invite code');
                }
            });

        return () => {
            isMounted = false;
        };
    }, [authLoading, isAdmin]);

    if (error) {
        return <p className="text-sm text-red-500">{error}</p>;
    }

    if (!invite) {
        return <p className="text-sm text-muted">Loading invite code...</p>;
    }

    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/invite/${invite.code}` : `/invite/${invite.code}`;
    const usesLeft = Math.max(0, invite.max_uses - invite.uses_count);

    return (
        <section className="rounded-xl border border-default bg-surface p-5">
            <h2 className="text-lg font-semibold text-text">Admin Invite Link</h2>
            <p className="mt-1 text-sm text-muted">
                {invite.revoked || usesLeft === 0
                    ? 'This code is no longer valid.'
                    : `${usesLeft} of ${invite.max_uses} uses remaining.`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded bg-bg px-3 py-2 text-sm text-text">{inviteUrl}</code>
                <button
                    type="button"
                    onClick={() => {
                        navigator.clipboard.writeText(inviteUrl).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                        });
                    }}
                    className="rounded-lg border border-default px-3 py-2 text-sm font-semibold text-text hover:bg-accent"
                >
                    {copied ? 'Copied!' : 'Copy link'}
                </button>
            </div>
        </section>
    );
}
