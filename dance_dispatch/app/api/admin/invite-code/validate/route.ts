import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

// GET /api/admin/invite-code/validate?code=XYZ - public check used before signup.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.trim().toUpperCase() ?? '';

    if (!code) {
        return NextResponse.json({ valid: false, reason: 'missing_code' });
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('get_admin_invite_code_status', { p_code: code });

    if (error || !data?.[0]?.is_valid) {
        return NextResponse.json({ valid: false, reason: 'not_found' });
    }

    return NextResponse.json({ valid: true });
}
