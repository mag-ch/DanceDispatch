import { NextResponse } from 'next/server';

/* Disabled invite-code creation endpoint retained for later use.
import { requireAdmin, getOrCreateInviteCode } from '@/lib/admin';

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
*/

export async function GET() {
    return NextResponse.json({ error: 'Invite codes are temporarily disabled.' }, { status: 410 });
}