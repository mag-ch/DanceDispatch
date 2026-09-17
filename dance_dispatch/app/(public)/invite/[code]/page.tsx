import { createClient } from '@/lib/supabase/server';
import InviteClient from './InviteClient';

interface InvitePageProps {
    params: Promise<{ code: string }>;
}

export default async function AdminInvitePage({ params }: InvitePageProps) {
    const { code: rawCode } = await params;
    const code = rawCode.trim().toUpperCase();

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('admin_invite_codes')
        .select('max_uses, uses_count, revoked')
        .eq('code', code)
        .maybeSingle();

    const isValid = !error && !!data && !data.revoked && data.uses_count < data.max_uses;

    return <InviteClient code={code} isValid={isValid} />;
}