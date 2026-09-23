'use server';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from './supabase/server';
import { User } from '@supabase/supabase-js';

// react's cache() only dedupes within a single request; a page load fans out
// into many separate API requests (each with its own request scope), and each
// one calling supabase.auth.getUser() re-verifies the JWT against the Supabase
// Auth server. This module-level cache dedupes that verification across those
// near-simultaneous requests so we don't trip Supabase's auth rate limit.
const USER_VERIFICATION_TTL_MS = 10_000;
const userVerificationCache = new Map<string, { user: User | null; expiresAt: number }>();
const userVerificationInFlight = new Map<string, Promise<User | null>>();

async function getSessionCacheKey(): Promise<string | null> {
    const cookieStore = await cookies();
    const authCookies = cookieStore.getAll().filter((c) => c.name.startsWith('sb-'));
    if (authCookies.length === 0) {
        return null;
    }
    return authCookies.map((c) => `${c.name}=${c.value}`).join(';');
}

/**
 * Cached auth helper - fetches the current user once per request
 * Use this in server components and API routes
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
    const cacheKey = await getSessionCacheKey();
    if (!cacheKey) {
        return null;
    }

    const cached = cacheKey ? userVerificationCache.get(cacheKey) : undefined;
    if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
    }

    const inFlight = userVerificationInFlight.get(cacheKey);
    if (inFlight) {
        return inFlight;
    }

    const verification = (async () => {
        const supabase = await createClient();
        let result: User | null;
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            // Stale, missing, or rate-limited auth requests are treated as signed out.
            result = error ? null : user;
        } catch {
            result = null;
        }

        if (userVerificationCache.size > 1000) {
            const now = Date.now();
            for (const [key, entry] of userVerificationCache) {
                if (entry.expiresAt <= now) userVerificationCache.delete(key);
            }
        }
        userVerificationCache.set(cacheKey, { user: result, expiresAt: Date.now() + USER_VERIFICATION_TTL_MS });
        return result;
    })();

    userVerificationInFlight.set(cacheKey, verification);
    try {
        return await verification;
    } finally {
        userVerificationInFlight.delete(cacheKey);
    }
});

/**
 * Requires authentication - throws if no user
 * Use this when you need to ensure a user is logged in
 */
export async function requireAuth(): Promise<User> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error('Unauthorized - user must be logged in');
    }
    return user;
}

/**
 * Gets the current user ID or null
 * Convenience helper for when you only need the ID
 */
export async function getCurrentUserId(): Promise<string | null> {
    const user = await getCurrentUser();
    return user?.id ?? null;
}
