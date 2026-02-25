import { getHosts } from '@/lib/utils';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hostId: string }> }
) {
    try {
        const { hostId } = await params;
        const hosts = await getHosts();
        const host = hosts.find(h => h.id === hostId);        
        if (!host) {
            return new Response(JSON.stringify({ error: 'Host not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify(host), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch host' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}