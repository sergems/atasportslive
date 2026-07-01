import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Swords, XCircle, Search, Clock, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchAllBets(status?: string, search?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (status && status !== 'all') params.set('status', status);
  const res = await fetch(`/api/bets/all?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load bets');
  return res.json() as Promise<{ bets: any[]; total: number; page: number; limit: number }>;
}

async function cancelBet(id: number) {
  const res = await fetch(`/api/bets/${id}/cancel`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to cancel'); }
  return res.json();
}

async function fetchUsers() {
  const res = await fetch('/api/users', { headers: authHeaders() });
  if (!res.ok) return { users: [] };
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
  matched:   'bg-teal-500/20 text-teal-400 border-teal-500/30',
  won:       'bg-green-500/20 text-green-400 border-green-500/30',
  lost:      'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  refunded:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const FILTERS = ['pending', 'matched', 'won', 'lost', 'cancelled', 'refunded'];

async function fetchGames() {
  const res = await fetch('/api/games?limit=500', { headers: authHeaders() });
  if (!res.ok) return { games: [] };
  return res.json();
}

function outcomeLabel(outcome: string, game: any): string {
  if (!game) return outcome?.replace(/_/g, ' ') ?? '';
  if (outcome === 'player_a_wins') return `${game.playerA} Wins`;
  if (outcome === 'player_b_wins') return `${game.playerB} Wins`;
  return outcome?.replace(/_/g, ' ') ?? '';
}

function displayName(user: any): string {
  if (!user) return '…';
  return user.fullName?.trim() || user.email?.split('@')[0] || `ID:${user.id}`;
}

export default function AdminBets() {
  useEffect(() => { document.title = 'Bet Management - Admin'; }, []);

  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bets', statusFilter, page],
    queryFn: () => fetchAllBets(statusFilter, search, page),
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });

  const { data: gamesData } = useQuery({
    queryKey: ['admin-games-list'],
    queryFn: fetchGames,
    staleTime: 60_000,
  });

  const userList: any[] = Array.isArray(usersData) ? usersData : (usersData as any)?.users || [];
  const userMap = new Map(userList.map((u: any) => [u.id, u]));

  const gameList: any[] = (gamesData as any)?.games || [];
  const gameMap = new Map(gameList.map((g: any) => [g.id, g]));

  const cancel = useMutation({
    mutationFn: (id: number) => cancelBet(id),
    onSuccess: () => {
      toast.success('Bet cancelled and stake refunded to user');
      setCancelConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['admin-bets'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel bet');
      setCancelConfirm(null);
    },
  });

  const bets = data?.bets || [];
  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  // Build a map of bet id → bet so we can look up the matched opponent
  const betMap = new Map(bets.map((b: any) => [b.id, b]));

  const filtered = search.trim()
    ? bets.filter((b: any) => {
        const user = userMap.get(b.userId);
        const name = (user?.fullName || '').toLowerCase();
        const email = (user?.email || '').toLowerCase();
        const ticket = (b.ticketId || '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || email.includes(q) || ticket.includes(q);
      })
    : bets;

  const stats = {
    pending: bets.filter((b: any) => b.status === 'pending').length,
    matched: bets.filter((b: any) => b.status === 'matched').length,
    total: data?.total || 0,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Swords className="h-6 w-6 text-amber-400" /> Bet Management
      </h1>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Bets',    value: stats.total,   color: 'text-white' },
          { label: 'Pending',       value: stats.pending, color: 'text-amber-400' },
          { label: 'Matched',       value: stats.matched, color: 'text-teal-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-slate-900 border-primary/20">
            <CardContent className="pt-4 pb-3 px-4">
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Status filter */}
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                    statusFilter === f ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative sm:ml-auto sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Search user or ticket…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 bg-slate-800 border-slate-700 text-white text-sm h-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 bg-slate-800 rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No bets found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((bet: any) => {
                const user = userMap.get(bet.userId);
                const isPending = bet.status === 'pending';
                const confirming = cancelConfirm === bet.id;
                return (
                  <div
                    key={bet.id}
                    className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-4 py-3 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`${STATUS_COLORS[bet.status]} border text-[10px] font-semibold px-1.5 py-0`}>
                          {bet.status}
                        </Badge>
                        <span className="text-xs text-slate-500 font-mono">{bet.ticketId}</span>
                        <span className="text-[10px] text-slate-600">#{bet.id}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const opponent = bet.matchedBetId ? betMap.get(bet.matchedBetId) : null;
                          const opponentUser = opponent ? userMap.get(opponent.userId) : null;
                          const thisWon = bet.status === 'won';
                          const opponentWon = bet.status === 'lost';
                          return (
                            <span className="text-sm flex items-center gap-1 flex-wrap">
                              <span className={thisWon ? 'text-white font-bold' : 'text-slate-300'}>
                                {displayName(user)}
                              </span>
                              {opponent && (
                                <>
                                  <span className="text-slate-600 text-xs">vs</span>
                                  <span className={opponentWon ? 'text-white font-bold' : 'text-slate-300'}>
                                    {displayName(opponentUser)}
                                  </span>
                                </>
                              )}
                            </span>
                          );
                        })()}
                        <span className="text-xs text-slate-500">
                          · {outcomeLabel(bet.outcome, gameMap.get(bet.gameId))}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-slate-600" />
                        <span className="text-[10px] text-slate-600">
                          {new Date(bet.createdAt).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-white font-mono font-bold">${bet.stake.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">stake</div>
                      {bet.potentialReturn > 0 && (
                        <div className="text-teal-400 font-mono text-xs">${bet.potentialReturn.toFixed(2)} payout</div>
                      )}
                    </div>
                    {isPending && (
                      <div className="shrink-0 ml-2">
                        {confirming ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-amber-400 whitespace-nowrap">Refund ${bet.stake.toFixed(2)}?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs px-2"
                              onClick={() => cancel.mutate(bet.id)}
                              disabled={cancel.isPending}
                            >
                              {cancel.isPending ? '…' : 'Yes'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-slate-400"
                              onClick={() => setCancelConfirm(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1"
                            onClick={() => setCancelConfirm(bet.id)}
                          >
                            <XCircle className="h-3 w-3" /> Cancel Bet
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">Page {page} of {totalPages} · {data?.total} total</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-7 text-xs border-slate-700 text-slate-400">Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="h-7 text-xs border-slate-700 text-slate-400">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
