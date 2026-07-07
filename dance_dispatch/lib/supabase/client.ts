// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

let browserClient: BrowserSupabaseClient | null = null;

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'): string {
    const value =
        name === 'NEXT_PUBLIC_SUPABASE_URL'
            ? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
            : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }

    return value;
}

function getBrowserClient(): BrowserSupabaseClient {
    if (browserClient) {
        return browserClient;
    }

    browserClient = createBrowserClient(
        getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
        getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    );

    return browserClient;
}

export const supabase = new Proxy({} as BrowserSupabaseClient, {
    get(_target, prop, receiver) {
        return Reflect.get(getBrowserClient(), prop, receiver);
    },
});

export const createClient = () => {
    return getBrowserClient();
};

export const APPROVED_USER_IDS = [
    'ba398812-06a0-4c48-9f15-0660d3af0047',
    'f2694e1c-5457-45b0-b299-c3a03a77d8c5',
    'e8191ca7-7856-4e81-9140-b93a944ec711'
];

export const canEditDetails = (userId?: string | null) => Boolean(userId && APPROVED_USER_IDS.includes(userId));
