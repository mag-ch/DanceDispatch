'use client';
import { useAuth } from '@/app/providers/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUsernameFromId } from '@/lib/utils_supabase';
import { ThemeToggle } from './ThemeProvider';

export function Header() {
    const { session, loading, logout } = useAuth();
    const router = useRouter();
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user?.id) {
            getUsernameFromId(session.user.id).then(setUsername);
        }
    }, [session?.user?.id]);

    const handleLogout = async () => {
        await logout();
        router.push('/auth/login');
    };

    if (loading) {
        return (
            <header className="site-header border-b border-border">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <Link href="/" className="text-2xl font-bold">DanceDispatch</Link>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="site-header shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4">
                <div className="flex justify-between items-center">
                    <Link href="/" className="text-2xl text-text font-bold">DanceDispatch</Link>
                    <nav className="flex items-center text-muted gap-4">
                        <ThemeToggle />
                        <Link href="/search" className="hover:underline">Search</Link>
                        {session ? (
                            <>
                                <Link href="/profile" className="hover:underline">{username}</Link>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/auth/login"
                                    className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/auth/signup"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
