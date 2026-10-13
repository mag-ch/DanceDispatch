// Env: CRON_SECRET
 
import { generateRecurringEvents } from '@/lib/recurrence'
import { NextResponse } from 'next/server'
 
export const dynamic = 'force-dynamic'
export const maxDuration = 60
 
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  try {
    return NextResponse.json(await generateRecurringEvents())
  } catch (e) {
    return new NextResponse(String(e), { status: 500 })
  }
}
 
export const POST = handle // pg_cron / pg_net
export const GET = handle  // Vercel Cron, if you use it instead
 