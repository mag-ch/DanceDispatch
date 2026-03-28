import { NextRequest, NextResponse } from 'next/server';
import { checkUserFollow } from '@/lib/utils_supabase_server';
import { requireAuth } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {

        const user = await requireAuth();
        
        const { userId } = await params;
        const isSaved = await checkUserFollow(user.id, userId);
        return NextResponse.json({ isSaved });
    } catch (error) {
        console.error('Error checking saved user:', error);
        return NextResponse.json({ error: 'Failed to check saved user' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const { saveToggle } = await request.json();
        if (typeof saveToggle !== 'boolean') {
            return NextResponse.json({ error: 'saveToggle must be a boolean' }, { status: 400 });
        }

        const { userId: followUserId } = await params;
        const user = await requireAuth();
        const supabase = await createClient();

        if (saveToggle) {
            const { error } = await supabase
                .from('UserFollowUsers')
                .insert({ followed_id: followUserId, user_id: user.id });
            if (error) {
                console.error('Error saving user follow:', error);
                return NextResponse.json({ error: 'Failed to save user follow' }, { status: 500 });
            }
        } else {
            const { error } = await supabase
                .from('UserFollowUsers')
                .delete()
                .eq('user_id', user.id)
                .eq('followed_id', followUserId);
            if (error) {
                console.error('Error unsaving user follow:', error);
                return NextResponse.json({ error: 'Failed to unsave user follow' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in POST /saved-users:', error);
        return NextResponse.json({ error: 'Failed to save user follow' }, { status: 500 });
    }
}
