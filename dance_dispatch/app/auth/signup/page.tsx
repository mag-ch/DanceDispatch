'use client';
import { useState } from 'react';
import { createClient } from "@/lib/supabase/server";
import { useRouter } from 'next/navigation';



export default function SignUp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

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
                },
            });
            if (error) throw error;
            const uuid = data.user?.id;

            // router.push('/auth/verify-email');
            router.push('/?userId=' + uuid);
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
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border px-4 py-2"
                />
                
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border px-4 py-2"
                />
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                >
                    {loading ? 'Signing up...' : 'Sign Up'}
                </button>
                <a href="/auth/login" className="text-sm text-blue-600 hover:underline">
                    Already have an account? Log in
                </a>
            </form>
        </div>
    );
}