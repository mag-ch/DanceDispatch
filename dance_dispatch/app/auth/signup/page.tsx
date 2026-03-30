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

    //check why this doesnt auto log you in
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error, data } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${location.origin}/auth/callback`,
                    data: {
                        full_name: fullName,
                        username: username,
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
                        full_name: fullName.trim(),
                        username: username.trim(),
                        email: email.trim().toLowerCase(),
                    },
                    { onConflict: 'id' }
                );

            if (profileError) {
                throw profileError;
            }
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (loginError){
                throw loginError;
            }

            router.push(returnPath || '/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign up failed');
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