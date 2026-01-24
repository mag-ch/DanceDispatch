'use server';

import { cache } from 'react';
import { createClient } from './supabase/server';
import { User } from '@supabase/supabase-js';

/**
 * Cached auth helper - fetches the current user once per request
 * Use this in server components and API routes
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
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
