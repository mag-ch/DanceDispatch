'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '../providers/AuthContext';
import { ReviewReply } from '@/lib/utils';

interface ReviewRepliesProps {
    reviewId: string;
}

type ReplyRow = {
    id: number;
    review_id: number;
    parent_reply_id: number | null;
    user_id: string;
    comment: string;
    created_at: string;
};

// Nests flat reply rows under their parent, the same way review rows are grouped into a tree.
function buildReplyTree(rows: ReplyRow[], usernameById: Map<string, string>): ReviewReply[] {
    const byId = new Map<string, ReviewReply>();
    for (const row of rows) {
        byId.set(String(row.id), {
            id: String(row.id),
            reviewId: String(row.review_id),
            parentReplyId: row.parent_reply_id != null ? String(row.parent_reply_id) : null,
            userId: row.user_id,
            username: usernameById.get(String(row.user_id)) ?? 'Someone',
            comment: row.comment,
            createdAt: row.created_at,
            replies: [],
        });
    }

    const roots: ReviewReply[] = [];
    for (const reply of byId.values()) {
        if (reply.parentReplyId && byId.has(reply.parentReplyId)) {
            byId.get(reply.parentReplyId)!.replies.push(reply);
        } else {
            roots.push(reply);
        }
    }
    return roots;
}

function countReplies(replies: ReviewReply[]): number {
    return replies.reduce((total, reply) => total + 1 + countReplies(reply.replies), 0);
}

export default function ReviewReplies({ reviewId }: ReviewRepliesProps) {
    const { session } = useAuth();
    const supabase = createClient();
    const [replies, setReplies] = useState<ReviewReply[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyDraft, setReplyDraft] = useState('');

    const loadReplies = useCallback(async () => {
        const { data, error } = await supabase
            .from('review_replies')
            .select('id, review_id, parent_reply_id, user_id, comment, created_at')
            .eq('review_id', Number(reviewId))
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Failed to load review replies:', error);
            setReplies([]);
            setLoading(false);
            return;
        }

        const rows = (data ?? []) as ReplyRow[];
        const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
        let usernameById = new Map<string, string>();
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username')
                .in('id', userIds);
            usernameById = new Map(
                (profiles ?? []).map((profile: any) => [String(profile.id), String(profile.username ?? 'Someone')])
            );
        }

        setReplies(buildReplyTree(rows, usernameById));
        setLoading(false);
    }, [reviewId, supabase]);

    useEffect(() => {
        void loadReplies();
    }, [loadReplies]);

    const submitReply = async (comment: string, parentReplyId: string | null) => {
        if (!session?.user?.id || !comment.trim()) return;
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/review-replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewId, parentReplyId, comment: comment.trim() }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.error || 'Failed to post reply');
            }
            await loadReplies();
        } catch (err) {
            console.error('Failed to post reply:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (replyId: string) => {
        try {
            const { error } = await supabase
                .from('review_replies')
                .delete()
                .eq('id', Number(replyId))
                .eq('user_id', session?.user?.id);
            if (error) throw error;
            await loadReplies();
        } catch (err) {
            console.error('Failed to delete reply:', err);
        }
    };

    const renderReply = (reply: ReviewReply, depth: number) => (
        <div key={reply.id} className={depth > 0 ? 'mt-2 border-l border-default pl-3' : 'mt-2'}>
            <div className="rounded-md bg-bg/50 p-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                        <Link href={`/users/${reply.userId}`} className="font-semibold text-text hover:underline">
                            {reply.username}
                        </Link>
                        <span className="text-muted">{new Date(reply.createdAt).toLocaleDateString()}</span>
                    </div>
                    {session?.user?.id === reply.userId && (
                        <button
                            type="button"
                            onClick={() => handleDelete(reply.id)}
                            title="Delete reply"
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
                <p className="mt-1 text-sm text-text">{reply.comment}</p>
                {session?.user?.id && (
                    replyingToId === reply.id ? (
                        <div className="mt-2 flex flex-col gap-2">
                            <textarea
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                placeholder={`Reply to ${reply.username}...`}
                                className="w-full rounded-md border border-default bg-surface p-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={isSubmitting || !replyDraft.trim()}
                                    onClick={async () => {
                                        await submitReply(replyDraft, reply.id);
                                        setReplyDraft('');
                                        setReplyingToId(null);
                                    }}
                                    className="btn-highlighted rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
                                >
                                    Post
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setReplyingToId(null); setReplyDraft(''); }}
                                    className="rounded-full px-3 py-1 text-xs font-medium text-muted hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { setReplyingToId(reply.id); setReplyDraft(''); }}
                            className="mt-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                            Reply
                        </button>
                    )
                )}
            </div>
            {reply.replies.map((child) => renderReply(child, depth + 1))}
        </div>
    );

    const totalCount = countReplies(replies);

    return (
        <div className="mt-3 border-t pt-3">
            <p className="text-xs font-semibold text-text/80">Comments{totalCount > 0 ? ` (${totalCount})` : ''}</p>

            {loading ? (
                <p className="mt-2 text-xs text-muted">Loading comments...</p>
            ) : (
                replies.map((reply) => renderReply(reply, 0))
            )}

            {session?.user?.id ? (
                <div className="mt-3 flex flex-col gap-2">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="w-full rounded-md border border-default bg-surface p-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                    />
                    <button
                        type="button"
                        disabled={isSubmitting || !newComment.trim()}
                        onClick={async () => {
                            await submitReply(newComment, null);
                            setNewComment('');
                        }}
                        className="btn-highlighted self-start rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                        Post comment
                    </button>
                </div>
            ) : (
                <p className="mt-2 text-xs text-muted">
                    <Link href="/auth/login" className="font-semibold hover:underline">Log in</Link> to comment.
                </p>
            )}
        </div>
    );
}
