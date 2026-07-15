import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Bet, BetListResponse, Game, GameListResponse, User, UserListResponse } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Swords, XCircle, Search, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchAllBets(status?: string, search?: string, page = 1): Promise<BetListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (status && status !== 'all') params.set('status', status);
  const res = await fetch(`/api/bets/all?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load bets');
  return res.json() as Promise<BetListResponse>;
}

async function cancelBet(id: number) {
  const res = await fetch(`/api/bets/${id}/cancel`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to cancel'); }
  return res.json();
}

async function fetchUsers(): Promise<UserListResponse> {
  const res = await fetch('/api/users', { headers: authHeaders() });
  if (!res.ok) return { users: [], total: 0, page: 1, limit: 50 };
  return res.json() as Promise<UserListResponse>;
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

async function fetchGames(): Promise<GameListResponse> {
  const res = await fetch('/api/games?limit=500', { headers: authHeaders() });
  if (!res.ok) return { games: [], total: 0, page: 1, limit: 500 };
  return res.json() as Promise<GameListResponse>;
}

function outcomeLabel(outcome: string, game: Game | undefined): string {
  if (!game) return outcome?.replace(/_/g, ' ') ?? '';
  if (outcome === 'player_a_wins') return `${game.playerA} Wins`;
  if (outcome === 'player_b_wins') return `${game.playerB} Wins`;
  return outcome?.replace(/_/g, ' ') ?? '';
}

function displayName(user: User | undefined): string {
  if (!user) return '…';
  return user.fullName?.trim() || user.email?.split('@')[0] || `ID:${user.id}`;
}

export default function AdminBets() {
  useEffect(() => { document.title = 'Prediction Management - Admin'; }, []);

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

  const userList: User[] = usersData?.users ?? [];
  const userMap = new Map(userList.map((u) => [u.id, u]));

  const gameList: Game[] = gamesData?.games ?? [];
  const gameMap = new Map(gameList.map((g) => [g.id, g]));

  const cancel = useMutation({
    mutationFn: (id: number) => cancelBet(id),
    onSuccess: () => {
      toast.success('Bet cancelled and stake refunded to user');
      setCancelConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['admin-bets'] });
    },
    onError: (err: Error) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Swords className="h-5 w-5 text-amber-400" /> Bets
        </h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          { label: 'Matched', value: stats.matched, color: 'text-teal-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="py-2 px-3">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</div>
              <div className={`text-lg font-bold font-mono leading-tight ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="py-2 px-3 border-b border-slate-800 flex flex-col sm:flex-row gap-2">
          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPage(1); }}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-colors ${
                  statusFilter === f ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative sm:ml-auto w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              placeholder="Search user or ticket…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 bg-slate-950 border-slate-800 text-white text-xs h-7 focus-visible:ring-1 focus-visible:ring-teal-500/50"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800 rounded" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">No bets found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filtered.map((bet: any) => {
                const user = userMap.get(bet.userId);
                const isPending = bet.status === 'pending';
                const confirming = cancelConfirm === bet.id;
                return (
                  <div
                    key={bet.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`px-1.5 py-0 rounded-full border text-[9px] font-bold uppercase tracking-wider ${STATUS_COLORS[bet.status]}`}>
                          {bet.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{bet.ticketId}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {(() => {
                          const opponent: any = bet.matchedBetId ? betMap.get(bet.matchedBetId) : undefined;
                          const opponentUser = opponent ? userMap.get(opponent.userId) : undefined;
                          const thisWon = bet.status === 'won';
                          const opponentWon = bet.status === 'lost';
                          return (
                            <span className="flex items-center gap-1 flex-wrap">
                              <span className={`truncate max-w-[100px] sm:max-w-[150px] ${thisWon ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {displayName(user)}
                              </span>
                              {opponent != null && (
                                <>
                                  <span className="text-slate-600 text-[10px]">vs</span>
                                  <span className={`truncate max-w-[100px] sm:max-w-[150px] ${opponentWon ? 'text-white font-bold' : 'text-slate-300'}`}>
                                    {displayName(opponentUser)}
                                  </span>
                                </>
                              )}
                            </span>
                          );
                        })()}
                        <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                          · {outcomeLabel(bet.outcome, gameMap.get(bet.gameId))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="text-white font-mono text-xs font-bold">${bet.stake.toFixed(2)}</div>
                      {(bet.potentialReturn ?? 0) > 0 && (
                        <div className="text-teal-400 font-mono text-[10px]">${(bet.potentialReturn ?? 0).toFixed(2)}</div>
                      )}
                    </div>
                    
                    <div className="w-16 flex justify-end shrink-0">
                      {isPending && (
                        confirming ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 w-6 p-0 rounded-full"
                              onClick={() => cancel.mutate(bet.id)}
                              disabled={cancel.isPending}
                              title="Confirm Cancel"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[10px] px-1.5 text-slate-400 hover:text-white"
                              onClick={() => setCancelConfirm(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                            onClick={() => setCancelConfirm(bet.id)}
                            title="Cancel Bet"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-2 border-t border-slate-800 bg-slate-900/50">
              <span className="text-[10px] text-slate-500">Page {page} of {totalPages} · {data?.total}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-6 px-2 text-[10px] border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700">Prev</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="h-6 px-2 text-[10px] border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
