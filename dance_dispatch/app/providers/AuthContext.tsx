'use client';
import { createClient } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';

interface AuthContextType {
    session: Session | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (error) {
                    console.warn('Failed to get auth session:', error.message);
                    setSession(null);
                } else {
                    setSession(data.session);
                }
            } catch (error) {
                console.warn('Auth session bootstrap failed:', error);
                setSession(null);
            } finally {
                setLoading(false);
            }
        };

        checkSession();

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
        });

        return () => {
            data?.subscription.unsubscribe();
        };
    }, [supabase]);

    const logout = async () => {
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
