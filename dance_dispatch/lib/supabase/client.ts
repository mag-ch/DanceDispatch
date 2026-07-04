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
