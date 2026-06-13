'use client';
import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase/client";
import { useRouter } from 'next/navigation';



export default function SignUp() {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [returnPath, setReturnPath] = useState('/');
    const [referrerId, setReferrerId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let nextPath = '/';
        const referrer = document.referrer;

        if (referrer) {
            try {
                const refUrl = new URL(referrer);
                const sameOrigin = refUrl.origin === window.location.origin;
                if (sameOrigin) {
                    const candidate = `${refUrl.pathname}${refUrl.search}${refUrl.hash}`;
                    if (candidate && candidate !== window.location.pathname && !candidate.startsWith('/auth/')) {
                        nextPath = candidate;
                    }
                }
            } catch {
                nextPath = '/';
            }
        }

        setReturnPath(nextPath);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref) setReferrerId(ref);
    }, []);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const trimmedUsername = username.trim();
            const trimmedFullName = fullName.trim();

            const { error, data } = await supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(returnPath || '/')}`,
                    data: {
                        full_name: trimmedFullName,
                        username: trimmedUsername,
                    },
                },
            });
            if (error) throw error;
            const uuid = data.user?.id;
            if (!uuid) {
                throw new Error('Sign up succeeded but user id is missing');
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(
                    {
                        id: uuid,
                        full_name: trimmedFullName,
                        username: trimmedUsername,
                        email: normalizedEmail,
                    },
                    { onConflict: 'id' }
                );

            if (profileError) {
                throw profileError;
            }

            if (!data.session) {
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });
                if (loginError) {
                    throw loginError;
                }
            }

            if (referrerId) {
                await fetch('/api/referral', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ referrerId }),
                }).catch(() => { /* non-critical — don't block sign-up */ });
            }

            const target = returnPath && returnPath.startsWith('/auth/') ? '/' : (returnPath || '/');
            router.replace(target);
        } catch (err) {
            const authErr = err as { status?: number; code?: string; message?: string };
            if (authErr?.status === 429 || authErr?.code === 'over_request_rate_limit') {
                setError('Too many auth requests. Please wait a moment and try again.');
            } else {
                setError(err instanceof Error ? err.message : 'Sign up failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center">
            <form onSubmit={handleSignUp} className="w-full max-w-md space-y-4">
                <h1 className="text-2xl font-bold">Sign Up</h1>
                
                {error && <p className="text-red-500">{error}</p>}
                
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full border rounded-lg px-4 py-2"
                />
                <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full border rounded-lg px-4 py-2"
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border rounded-lg px-4 py-2"
                />
                
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border rounded-lg px-4 py-2"
                />
                <span className="w-full flex flex-col items-center">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-highlighted rounded-lg px-8 py-2 text-white disabled:opacity-50"
                    >
                        {loading ? 'Signing up...' : 'Sign Up'}
                    </button>
                </span>
                <a href="/auth/login" className="text-sm text-blue-600 hover:underline">
                    Already have an account? Log in
                </a>
            </form>
        </div>
    );
}