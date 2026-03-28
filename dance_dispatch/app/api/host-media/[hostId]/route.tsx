import { getHostMedia } from '@/lib/utils_supabase_server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const { hostId } = await params;
        const media = await getHostMedia(hostId);
        
        if (!media) {
            return new Response(JSON.stringify({ error: `Media for ${hostId} not found` }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(media), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch media' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
