'use client';
import { useState } from 'react';
import { createClient } from "@/lib/supabase/server";
import { useRouter } from 'next/navigation';



export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        setError(error.message);
        return;
    }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <form onSubmit={handleLogin} className="w-full max-w-md p-6 border rounded-lg">
                <h1 className="text-2xl font-bold mb-6">Login</h1>
                
                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
                
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mb-4 p-2 border rounded"
                    required
                />
                
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-6 p-2 border rounded"
                    required
                />
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <div className="mt-4 text-center">
                    <a href="/auth/signup" className="text-blue-600 hover:underline">
                        Don't have an account? Sign Up
                    </a>
                    {/* forgot password link can be added here */}
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => router.push('/auth/forgot-password')}
                        className="ml-4 text-blue-600 hover:underline"
                    >Forgot Password?</button>
                </div>
            </form>
        </div>
    );
}