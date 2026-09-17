import { NextResponse } from 'next/server';
import { requireAdmin, getOrCreateInviteCode } from '@/lib/admin';

// GET /api/admin/invite-code - returns (creating if needed) the caller's single invite code.
export async function GET() {
    try {
        const user = await requireAdmin();
        const invite = await getOrCreateInviteCode(user.id);
        return NextResponse.json(invite);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load invite code';
        const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
