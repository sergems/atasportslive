import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, EyeOff, Eye, Ban, ShieldCheck, Search, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

type CommentRow = {
  id: number; streamId: number; streamTitle: string; userId: number;
  username: string; userEmail: string | null; content: string;
  isHidden: boolean; hiddenAt: string | null; hideReason: string | null; createdAt: string;
};
type BanRow = {
  userId: number; username: string; userEmail: string | null;
  bannedUntil: string; reason: string | null; createdAt: string;
};

const DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

export default function CommentModeration() {
  useEffect(() => { document.title = 'Comment Moderation - ATA Platform'; }, []);
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [banFor, setBanFor] = useState<CommentRow | BanRow | null>(null);
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-comments'] });
    qc.invalidateQueries({ queryKey: ['admin-comment-bans'] });
  };

  const { data: comments = [], isLoading } = useQuery<CommentRow[]>({
    queryKey: ['admin-comments', tab, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (tab === 'hidden') params.set('hidden', 'true');
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/comments?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load comments');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: bans = [] } = useQuery<BanRow[]>({
    queryKey: ['admin-comment-bans'],
    queryFn: async () => {
      const res = await fetch('/api/admin/comment-bans', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load comment bans');
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const hideMut = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) =>
      fetch(`/api/admin/comments/${id}/hide`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ hidden, reason: reason || undefined }),
      }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error || 'Failed'); }),
    onSuccess: (_, v) => { toast.success(v.hidden ? 'Comment hidden' : 'Comment restored'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const banMut = useMutation({
    mutationFn: () => {
      if (!banFor) return Promise.resolve();
      return fetch('/api/admin/comment-bans', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ userId: banFor.userId, hours, reason }),
      }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error || 'Failed'); });
    },
    onSuccess: () => {
      const until = new Date(Date.now() + hours * 3600_000).toLocaleString();
      toast.success(`Commenting blocked until ${until}`);
      setBanFor(null); setReason(''); invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unbanMut = useMutation({
    mutationFn: (userId: number) =>
      fetch(`/api/admin/comment-bans/${userId}`, { method: 'DELETE', headers: authHeaders() })
        .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error || 'Failed'); }),
    onSuccess: () => { toast.success('Comment restriction removed'); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const hiddenCount = comments.filter((c) => c.isHidden).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-400" /> Comment Moderation
          </h1>
          <p className="text-slate-400 text-sm mt-1">Hide abusive comments and restrict users from chatting.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ['admin-comments'] });
          qc.invalidateQueries({ queryKey: ['admin-comment-bans'] });
        }} className="text-slate-400 hover:text-white gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-slate-900 border-slate-800"><CardContent className="py-4">
          <div className="text-2xl font-bold text-white">{comments.length}</div>
          <div className="text-xs text-slate-500">Comments loaded</div>
        </CardContent></Card>
        <Card className="bg-slate-900 border-slate-800"><CardContent className="py-4">
          <div className="text-2xl font-bold text-amber-400">{hiddenCount}</div>
          <div className="text-xs text-slate-500">Hidden in this view</div>
        </CardContent></Card>
        <Card className="bg-slate-900 border-slate-800"><CardContent className="py-4">
          <div className="text-2xl font-bold text-red-400">{bans.length}</div>
          <div className="text-xs text-slate-500">Active commenting blocks</div>
        </CardContent></Card>
      </div>

      {/* Active blocks */}
      {bans.length > 0 && (
        <Card className="bg-slate-900 border-red-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-white text-sm flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-400" /> Active commenting blocks
          </CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bans.map((b) => (
              <div key={b.userId} className="flex items-center justify-between gap-3 rounded border border-slate-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{b.username}</p>
                  <p className="text-slate-500 text-[11px] truncate">
                    Until {new Date(b.bannedUntil).toLocaleString()}{b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => unbanMut.mutate(b.userId)}
                  className="h-7 px-2 text-[11px] text-teal-400 hover:text-white shrink-0">Unblock</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Comments */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-white text-sm mr-auto">Comments</CardTitle>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setTab('all')}
                className={`h-7 rounded border px-2 text-[11px] font-semibold ${tab === 'all' ? 'border-teal-500 bg-teal-500 text-slate-950' : 'border-slate-700 text-slate-400'}`}>All</button>
              <button type="button" onClick={() => setTab('hidden')}
                className={`h-7 rounded border px-2 text-[11px] font-semibold ${tab === 'hidden' ? 'border-teal-500 bg-teal-500 text-slate-950' : 'border-slate-700 text-slate-400'}`}>Hidden</button>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search comments"
                className="pl-7 bg-slate-950 border-slate-800 text-white text-xs h-7" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800 rounded" />)}</div>
          ) : comments.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">No comments found.</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className={`rounded border px-3 py-2 ${c.isHidden ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-800/40'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-xs font-semibold">{c.username}</span>
                        <span className="text-slate-600 text-[10px]">· {c.streamTitle}</span>
                        {c.isHidden && <Badge className="border border-red-500/40 text-red-400 bg-red-500/10 text-[9px]">HIDDEN</Badge>}
                      </div>
                      <p className="text-slate-300 text-xs mt-1 break-words">{c.content}</p>
                      <p className="text-slate-600 text-[10px] mt-1">{new Date(c.createdAt).toLocaleString()}{c.hideReason ? ` · ${c.hideReason}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" title={c.isHidden ? 'Restore comment' : 'Hide comment'}
                        onClick={() => { setReason(''); hideMut.mutate({ id: c.id, hidden: !c.isHidden }); }}
                        className="rounded border border-amber-500/40 px-1.5 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/10 flex items-center gap-1">
                        {c.isHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        <span className="hidden sm:inline">{c.isHidden ? 'Restore' : 'Hide'}</span>
                      </button>
                      <button type="button" title="Block user from commenting"
                        onClick={() => { setBanFor(c); setHours(24); setReason(''); }}
                        className="rounded border border-red-500/40 px-1.5 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-1">
                        <Ban className="h-3 w-3" /><span className="hidden sm:inline">Block user</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ban dialog */}
      {banFor && (
        <Card className="bg-slate-900 border-red-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-white text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-red-400" /> Block {banFor.username} from commenting
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button key={d.hours} type="button" onClick={() => setHours(d.hours)}
                  className={`h-7 rounded border px-2 text-[11px] font-semibold ${hours === d.hours ? 'border-red-500 bg-red-500/20 text-red-300' : 'border-slate-700 text-slate-400'}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
              className="bg-slate-950 border-slate-800 text-white text-xs" />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBanFor(null)} className="text-slate-400">Cancel</Button>
              <Button size="sm" disabled={banMut.isPending} onClick={() => banMut.mutate()}
                className="bg-red-500 hover:bg-red-400 text-white">
                {banMut.isPending ? 'Saving…' : `Block for ${DURATIONS.find(d => d.hours === hours)?.label ?? `${hours}h`}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
