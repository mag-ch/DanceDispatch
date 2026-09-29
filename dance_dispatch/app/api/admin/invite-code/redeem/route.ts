import { NextResponse } from 'next/server';

/* Disabled invite-code redemption endpoint retained for later use.
import { requireAuth } from '@/lib/auth-helpers';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        await requireAuth();
        const body = await request.json().catch(() => ({}));
        const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
        if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });

        const supabase = await createServerClient();
        const { data, error } = await supabase.rpc('redeem_admin_invite_code', { p_code: code });
        if (error) return NextResponse.json({ error: 'Failed to redeem invite code' }, { status: 500 });
        if (!data) return NextResponse.json({ error: 'This invite code is no longer valid.' }, { status: 410 });
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to redeem invite code';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
*/

export async function POST() {
    return NextResponse.json({ error: 'Invite codes are temporarily disabled.' }, { status: 410 });
}