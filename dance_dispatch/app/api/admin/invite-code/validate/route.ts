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
    const { data, error } = await supabase
        .from('admin_invite_codes')
        .select('max_uses, uses_count, revoked')
        .eq('code', code)
        .maybeSingle();

    if (error || !data) {
        return NextResponse.json({ valid: false, reason: 'not_found' });
    }

    if (data.revoked || data.uses_count >= data.max_uses) {
        return NextResponse.json({ valid: false, reason: 'exhausted' });
    }

    return NextResponse.json({ valid: true });
}
