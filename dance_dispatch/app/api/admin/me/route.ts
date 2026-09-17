import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth-helpers';
import { isAdmin } from '@/lib/admin';

// GET /api/admin/me - lets client components conditionally show admin-only UI.
export async function GET() {
    const userId = await getCurrentUserId();
    const admin = await isAdmin(userId);
    return NextResponse.json({ isAdmin: admin });
}
