import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

type SubmittedIssueRow = Record<string, any>;

function pickIssueText(row: SubmittedIssueRow): string {
  const candidates = [
    row.description,
    row.content,
    row.issue,
    row.issue_text,
    row.message,
    row.body,
    row.text,
  ];

  const firstText = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof firstText === 'string' ? firstText : '';
}

async function insertIssue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  content: string
) {
  const { data, error } = await supabase
      .from('UserSubmittedFeedback')
      .insert({ user_id: userId, content, status: 'new' })
      .select('*')
      .single();

    if (!error) {
      return { data, error: null };
    }

    
  return { data: null, error: error };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

    const { data, error } = await supabase
      .from('UserSubmittedFeedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error loading user feedback:', error);
      return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
    }

    const items = (data ?? []).map((row: SubmittedIssueRow, index: number) => ({
      id: String(row.id ?? `${row.created_at ?? 'row'}-${index}`),
      content: pickIssueText(row),
      createdAt: row.created_at ?? new Date().toISOString(),
      status: typeof row.status === 'string' ? row.status : null,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error in GET /api/feedback:', error);
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Feedback cannot be empty' }, { status: 400 });
    }

    const { data, error } = await insertIssue(supabase, user.id, content);

    if (error) {
      console.error('Error saving feedback:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({
      id: String(data?.id ?? Date.now()),
      content: pickIssueText(data ?? {}),
      createdAt: data?.created_at ?? new Date().toISOString(),
      status: typeof data?.status === 'string' ? data.status : null,
    });
  } catch (error) {
    console.error('Error in POST /api/feedback:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
