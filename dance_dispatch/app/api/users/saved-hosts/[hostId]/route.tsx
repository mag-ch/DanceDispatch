import { NextRequest, NextResponse } from 'next/server';
import { checkHostSaved } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {

        const user = await requireAuth();
        
        const { hostId } = await params;
        const isSaved = await checkHostSaved(hostId, user.id);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved host:', error);
        return NextResponse.json({ error: 'Failed to check saved host' }, { status: 500 });
    }
}
