import { createClient } from '@/lib/supabase/server';
import InviteClient from './InviteClient';

interface InvitePageProps {
    params: Promise<{ code: string }>;
}

export default async function AdminInvitePage({ params }: InvitePageProps) {
    const { code: rawCode } = await params;
    const code = rawCode.trim().toUpperCase();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_admin_invite_code_status', { p_code: code });

    const isValid = !error && data?.[0]?.is_valid === true;

    return <InviteClient code={code} isValid={isValid} />;
}