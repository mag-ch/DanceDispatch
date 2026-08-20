import { NextRequest, NextResponse } from 'next/server';
import { checkHostSaved, userSaveHost } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

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

export async function POST(request: Request, { params }: { params: Promise<{ hostId: string }> }) {
    try {
        const { saveToggle } = await request.json();
        if (typeof saveToggle !== 'boolean') {
            return NextResponse.json({ error: 'saveToggle must be a boolean' }, { status: 400 });
        }

        const { hostId } = await params;
        const numericHostId = Number(hostId);
        if (Number.isNaN(numericHostId)) {
            return NextResponse.json({ error: 'Invalid host id' }, { status: 400 });
        }

        const user = await requireAuth();
        const supabase = await createClient();
      
        await userSaveHost(String(numericHostId), user.id, saveToggle);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in POST /saved-hosts:', error);
        return NextResponse.json({ error: 'Failed to save host' }, { status: 500 });
    }
}
