import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

export async function isAdmin(userId?: string | null): Promise<boolean> {
    if (!userId) {
        return false;
    }

    const supabase = await createClient();
    const { data } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    return Boolean(data);
}

/** Throws (message contains "Unauthorized") if the caller isn't signed in or isn't an admin. */
export async function requireAdmin() {
    const user = await requireAuth();
    if (!(await isAdmin(user.id))) {
        throw new Error('Unauthorized - admin access required');
    }
    return user;
}

function generateInviteCode(): string {
    return Array.from({ length: 6 }, () => Math.floor(Math.random() * 36).toString(36))
        .join('')
        .toUpperCase();
}

/** Fetches the admin's existing invite code, creating one (max 25 uses) if none exists yet. */
export async function getOrCreateInviteCode(userId: string, numberofuses: number = 1) {
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
        .from('admin_invite_codes')
        .select('code, max_uses, uses_count, revoked')
        .eq('owner_user_id', userId)
        .maybeSingle();

    if (fetchError) {
        throw fetchError;
    }

    if (existing) {
        return existing;
    }

    const { data: created, error: insertError } = await supabase
        .from('admin_invite_codes')
        .insert({ owner_user_id: userId, code: generateInviteCode(), max_uses: numberofuses })
        .select('code, max_uses, uses_count, revoked')
        .single();

    if (insertError) {
        throw insertError;
    }

    return created;
}
