'use client';
import { createClient } from '@/lib/supabase/client';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
    session: Session | null;
    loading: boolean;
    logout: () => Promise<void>;
}

let bootstrapPromise: Promise<Session | null> | null = null;
let cachedBootstrapSession: Session | null = null;
let cachedBootstrapAt = 0;
let authRateLimitedUntil = 0;
const BOOTSTRAP_CACHE_TTL_MS = 5000;
const AUTH_RATE_LIMIT_COOLDOWN_MS = 30000;

async function getBootstrappedSession() {
    const now = Date.now();
    if (bootstrapPromise) {
        return bootstrapPromise;
    }

    if (now < authRateLimitedUntil) {
        return cachedBootstrapSession;
    }

    if (now - cachedBootstrapAt < BOOTSTRAP_CACHE_TTL_MS) {
        return cachedBootstrapSession;
    }

    const supabase = createClient();

    bootstrapPromise = (async () => {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            const authError = error as { code?: string; status?: number };
            if (authError.code === 'refresh_token_not_found') {
                await supabase.auth.signOut({ scope: 'local' });
                cachedBootstrapSession = null;
                cachedBootstrapAt = Date.now();
                return null;
            }

            if (authError.status === 429 || authError.code === 'over_request_rate_limit') {
                authRateLimitedUntil = Date.now() + AUTH_RATE_LIMIT_COOLDOWN_MS;
                return cachedBootstrapSession;
            }

            throw error;
        }

        cachedBootstrapSession = data.session;
        cachedBootstrapAt = Date.now();
        authRateLimitedUntil = 0;
        return data.session;
    })();

    try {
        return await bootstrapPromise;
    } finally {
        bootstrapPromise = null;
    }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        const supabase = createClient();

        const checkSession = async () => {
            try {
                const bootstrappedSession = await getBootstrappedSession();
                setSession(bootstrappedSession);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'unknown error';
                console.warn('Auth session bootstrap failed:', message);
                setSession(null);
            } finally {
                setLoading(false);
            }

            try {
                const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
                    setSession(session);
                });

                unsubscribe = () => {
                    data?.subscription.unsubscribe();
                };
            } catch (error) {
                console.warn('Auth subscription setup failed:', error);
            }
        };

        void checkSession();

        return () => {
            unsubscribe?.();
        };
    }, []);

    const logout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ session, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within AuthContextProvider');
    }
    return context;
}
