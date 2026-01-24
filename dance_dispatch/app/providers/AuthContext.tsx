'use client';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
    session: Session | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            const supa = await supabase;
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            setLoading(false);
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
