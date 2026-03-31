import { getHostComments } from '@/lib/server_utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const { hostId } = await params;
        const comments = await getHostComments(hostId);

        return new Response(JSON.stringify(comments ?? []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch host comments' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
