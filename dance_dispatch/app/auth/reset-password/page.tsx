'use client';
import { useEffect, useState } from 'react';
import { createClient } from "@/lib/supabase/server";
import { useRouter, useSearchParams } from 'next/navigation';



const supabase = createClient();

export default function ResetPasswordPage() {
    const searchParams = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const { error: err, data } = await supabase.auth.updateUser({
                password: password,
            });

            if (err) throw err;
            const uuid = data.user?.id;

            setSuccess(true);
            setPassword('');
            setConfirmPassword('');

            const router = useRouter();

            const timer = setTimeout(() => {
                console.log('5 seconds passed, redirecting...');
                // Redirect to the home page using router.push
                router.push('/?userId=' + uuid);
                }, 5000);

                // Clean up the timeout if the component unmounts before the delay finishes
                return () => clearTimeout(timer);
                
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6">Reset Password</h1>

                {success && (
                    <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">
                        Password reset successfully!
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
                        {error}
                    </div>
                )}

                <form onSubmit={handleResetPassword}>
                    <div className="mb-4">
                        <label className="block font-semibold mb-2">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block font-semibold mb-2">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}