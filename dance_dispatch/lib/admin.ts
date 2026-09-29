import 'server-only';

import { requireAuth } from '@/lib/auth-helpers';

export async function isAdmin(userId?: string | null): Promise<boolean> {
    return Boolean(userId);
}

/** Temporary policy: every authenticated account passes the admin gate. */
export async function requireAdmin() {
    const user = await requireAuth();
    if (!(await isAdmin(user.id))) {
        throw new Error('Unauthorized - admin access required');
    }
    return user;
}

// Invite-code generation is temporarily disabled and retained for later.
// import { createClient } from '@/lib/supabase/server';
// function generateInviteCode(): string {
//     return Array.from({ length: 6 }, () => Math.floor(Math.random() * 36).toString(36))
//         .join('')
//         .toUpperCase();
// }
// export async function getOrCreateInviteCode(userId: string, numberofuses: number = 1) {
//     const supabase = await createClient();
//     const { data: existing, error: fetchError } = await supabase
//         .from('admin_invite_codes')
//         .select('code, max_uses, uses_count, revoked')
//         .eq('owner_user_id', userId)
//         .maybeSingle();
//     if (fetchError) throw fetchError;
//     if (existing) return existing;
//     const { data: created, error: insertError } = await supabase
//         .from('admin_invite_codes')
//         .insert({ owner_user_id: userId, code: generateInviteCode(), max_uses: numberofuses })
//         .select('code, max_uses, uses_count, revoked')
//         .single();
//     if (insertError) throw insertError;
//     return created;
// }

