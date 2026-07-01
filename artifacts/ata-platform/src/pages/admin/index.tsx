import React, { useEffect, useState } from 'react';
import { useGetAdminStats, useGetRecentActivity, useSettleGame, getListGamesQueryKey } from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  Users, Wallet, TrendingUp, Radio, Trophy, ArrowUpRight, Clock,
  ChevronRight, CheckCircle2, ShieldCheck, Gavel, Hourglass, AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

function useWithdrawalPipeline() {
  const token = useAuthStore.getState().token;
  return useQuery({
    queryKey: ['admin-withdrawal-pipeline'],
    queryFn: async () => {
      const headers = { Authorization: `Bearer ${token}` };
      const [approvedRes, statsRes] = await Promise.all([
        fetch('/api/admin/approved-withdrawals', { headers }),
        fetch('/api/admin/finance-stats', { headers }),
      ]);
      const approved = approvedRes.ok ? await approvedRes.json() : [];
      const finStats = statsRes.ok ? await statsRes.json() : {};
      return {
        approvedCount: Array.isArray(approved) ? approved.length : 0,
        approvedValue: Array.isArray(approved)
          ? approved.reduce((s: number, t: any) => s + Number(t.amount), 0)
          : 0,
        paidToday: finStats.paidToday ?? 0,
        paidCount: finStats.paidCount ?? 0,
      };
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function useSettlementDue() {
  const token = useAuthStore.getState().token;
  return useQuery({
    queryKey: ['admin-settlement-due'],
    queryFn: async () => {
      const res = await fetch('/api/games?status=live&limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const games: any[] = data.games || [];
      return games.filter(
        (g: any) => !['competition', 'tour'].includes(g.type ?? '') && g.matchedBetsCount > 0,
      );
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function timeAgo(dateStr: string, timeStr: string): string {
  const start = new Date(`${dateStr}T${timeStr || '00:00'}`);
  const diffMs = Date.now() - start.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hrs}h ${mins}m ago` : `${hrs}h ago`;
}

function SettleRow({ game, onSettled }: { game: any; onSettled: () => void }) {
  const [result, setResult] = useState('player_a_wins');
  const [open, setOpen] = useState(false);
  const settleGame = useSettleGame();

  const handle = async () => {
    try {
      await settleGame.mutateAsync({ id: game.id, data: { result: result as any } });
      toast.success(`${game.playerA} vs ${game.playerB} settled`);
      onSettled();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.error || 'Failed to settle');
    }
  };

  const elapsed = timeAgo(game.eventDate, game.eventTime);
  const pool = parseFloat(game.totalBetPool || '0');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3.5 border-b border-slate-800 last:border-0">
      {/* Game info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-white font-semibold text-sm truncate">
            {game.playerA} <span className="text-slate-500 font-normal text-xs">vs</span> {game.playerB}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 capitalize border border-slate-700 rounded px-1 py-px">
            {game.sport}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Hourglass className="h-3 w-3 text-orange-400" /> Started {elapsed}
          </span>
          <span className="flex items-center gap-1 text-teal-400 font-mono">
            <Trophy className="h-3 w-3" /> {game.matchedBetsCount} matched pair{game.matchedBetsCount !== 1 ? 's' : ''}
          </span>
          {pool > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-mono">
              Pool ${pool.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Settle action */}
      <div className="flex items-center gap-2 shrink-0">
        {open ? (
          <>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
            >
              <option value="player_a_wins">{game.playerA} Wins</option>
              <option value="player_b_wins">{game.playerB} Wins</option>
              <option value="draw">Draw</option>
            </select>
            <Button
              size="sm"
              onClick={handle}
              disabled={settleGame.isPending}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold h-7 text-xs px-3"
            >
              {settleGame.isPending ? 'Settling…' : 'Confirm'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-slate-400 h-7 text-xs px-2"
            >
              ✕
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 h-7 text-xs px-3 font-semibold"
          >
            <Gavel className="h-3 w-3 mr-1.5" /> Settle
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  useEffect(() => { document.title = 'Admin Dashboard - ATA Platform'; }, []);

  const qc = useQueryClient();
  const { data: stats, isLoading } = useGetAdminStats();
  const { data: activity } = useGetRecentActivity({ limit: 10 });
  const { data: pipeline, isLoading: pipelineLoading } = useWithdrawalPipeline();
  const { data: settlementGames = [], isLoading: settlementLoading } = useSettlementDue();

  const invalidateGames = () => {
    qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
    qc.invalidateQueries({ queryKey: ['admin-settlement-due'] });
  };

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers, icon: Users, color: 'text-teal-400', sub: `${stats?.activeUsers || 0} active` },
    { label: 'Total Balance', value: `$${(stats?.totalWalletBalance || 0).toFixed(2)}`, icon: Wallet, color: 'text-amber-400', sub: `$${(stats?.totalDepositsToday || 0).toFixed(2)} today` },
    { label: 'Total Revenue', value: `$${(stats?.totalRevenue || 0).toFixed(2)}`, icon: TrendingUp, color: 'text-green-400', sub: `$${(stats?.brokerageRevenue || 0).toFixed(2)} brokerage` },
    { label: 'Live Streams', value: stats?.liveStreams, icon: Radio, color: 'text-red-400', sub: `$${(stats?.streamingRevenue || 0).toFixed(2)} revenue` },
    { label: 'Open Bets', value: stats?.openBets, icon: Trophy, color: 'text-purple-400', sub: `${stats?.matchedBets || 0} matched` },
    { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals, icon: Clock, color: 'text-orange-400', sub: 'Need approval' },
  ];

  const TX_SIGN: Record<string, string> = { deposit: '+', withdrawal: '-', bet_stake: '-', bet_win: '+', bet_refund: '+', stream_access: '-', brokerage_fee: '+' };
  const TX_COLOR: Record<string, string> = { deposit: 'text-teal-400', withdrawal: 'text-red-400', bet_win: 'text-green-400', bet_stake: 'text-amber-400', brokerage_fee: 'text-teal-400', stream_access: 'text-purple-400' };

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-white tracking-tight truncate">Admin Dashboard</h1>
          <p className="text-slate-400 mt-0.5 text-xs sm:text-sm">Platform overview and management.</p>
        </div>
        <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">Admin</Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        {statCards.map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="bg-slate-900 border-primary/20">
            <CardContent className="pt-3 pb-3 px-3 sm:pt-5 sm:px-4">
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color} mb-1.5`} />
              {isLoading ? <Skeleton className="h-6 w-14 bg-slate-800 mb-1" /> : (
                <div className={`text-base sm:text-xl font-bold font-mono ${color} truncate`}>{value ?? '—'}</div>
              )}
              <div className="text-slate-400 text-[10px] sm:text-xs font-medium mt-0.5 leading-tight">{label}</div>
              <div className="text-slate-600 text-[10px] hidden sm:block">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settlement Due — only shown when there are live games with matched bets */}
      {(settlementLoading || settlementGames.length > 0) && (
        <Card className={`bg-slate-900 border ${settlementGames.length > 0 ? 'border-orange-500/40' : 'border-primary/20'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base sm:text-lg flex items-center gap-2">
                <Gavel className="h-4 w-4 text-orange-400" />
                Settlement Due
                {settlementGames.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-orange-500 text-slate-950 text-[10px] font-bold">
                    {settlementGames.length}
                  </span>
                )}
              </CardTitle>
              <Link href="/admin/games">
                <span className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-0.5">
                  All Games <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              These matches are live and have matched bets waiting on a result.
            </p>
          </CardHeader>
          <CardContent>
            {settlementLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg bg-slate-800" />)}
              </div>
            ) : settlementGames.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                <CheckCircle2 className="h-4 w-4 text-teal-500" />
                All caught up — no live games awaiting settlement.
              </div>
            ) : (
              <div>
                {/* Urgency banner if any game started over 3 hours ago */}
                {settlementGames.some((g: any) => {
                  const start = new Date(`${g.eventDate}T${g.eventTime || '00:00'}`);
                  return Date.now() - start.getTime() > 3 * 60 * 60 * 1000;
                }) && (
                  <div className="flex items-center gap-2 mb-4 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2.5 text-xs text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    One or more games started over 3 hours ago. Settle them promptly so users receive their winnings.
                  </div>
                )}
                <div>
                  {settlementGames.map((game: any) => (
                    <SettleRow key={game.id} game={game} onSettled={invalidateGames} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Withdrawal Pipeline */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base sm:text-lg flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-amber-400" /> Withdrawal Pipeline
            </CardTitle>
            <Link href="/admin/withdrawals">
              <span className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-0.5">
                Manage <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">

            {/* Stage 1 — Pending */}
            <Link href="/admin/withdrawals" className="flex-1">
              <div className="group flex flex-col gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3.5 hover:bg-amber-500/10 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5" /> Pending Review
                  </div>
                  {!pipelineLoading && (stats?.pendingWithdrawals ?? 0) > 0 && (
                    <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                      {stats!.pendingWithdrawals}
                    </span>
                  )}
                </div>
                {pipelineLoading ? (
                  <Skeleton className="h-7 w-16 bg-slate-800" />
                ) : (
                  <div className="text-2xl font-bold font-mono text-white leading-tight">
                    {stats?.pendingWithdrawals ?? 0}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 leading-tight">Needs your approval before going to finance</p>
              </div>
            </Link>

            <ChevronRight className="h-5 w-5 text-slate-700 shrink-0 self-center rotate-90 sm:rotate-0" />

            {/* Stage 2 — At Finance */}
            <Link href="/admin/withdrawals" className="flex-1">
              <div className="group flex flex-col gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-3.5 hover:bg-blue-500/10 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5" /> At Finance
                  </div>
                  {!pipelineLoading && (pipeline?.approvedCount ?? 0) > 0 && (
                    <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {pipeline!.approvedCount}
                    </span>
                  )}
                </div>
                {pipelineLoading ? (
                  <Skeleton className="h-7 w-16 bg-slate-800" />
                ) : (
                  <>
                    <div className="text-2xl font-bold font-mono text-white leading-tight">
                      {pipeline?.approvedCount ?? 0}
                    </div>
                    {(pipeline?.approvedValue ?? 0) > 0 && (
                      <div className="text-xs text-slate-500 font-mono -mt-0.5">${(pipeline!.approvedValue).toFixed(2)} to pay</div>
                    )}
                  </>
                )}
                <p className="text-[11px] text-slate-500 leading-tight">Approved — finance team making payment</p>
              </div>
            </Link>

            <ChevronRight className="h-5 w-5 text-slate-700 shrink-0 self-center rotate-90 sm:rotate-0" />

            {/* Stage 3 — Paid Today */}
            <div className="flex-1 flex flex-col gap-1.5 rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" /> Paid Today
              </div>
              {pipelineLoading ? (
                <Skeleton className="h-7 w-16 bg-slate-800" />
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono text-teal-400 leading-tight">
                    ${(pipeline?.paidToday ?? 0).toFixed(2)}
                  </div>
                  {(pipeline?.paidCount ?? 0) > 0 && (
                    <div className="text-xs text-slate-500 font-mono -mt-0.5">{pipeline!.paidCount} total paid</div>
                  )}
                </>
              )}
              <p className="text-[11px] text-slate-500 leading-tight">Confirmed payments sent to users today</p>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader className="pb-3"><CardTitle className="text-white text-base sm:text-lg">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {!activity || activity.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((item: any) => (
                <div key={item.id} className="flex items-start justify-between gap-2 py-2 border-b border-slate-800 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
                      <span className="text-white text-xs sm:text-sm font-medium truncate">{item.userFullName || `User #${item.userId}`}</span>
                      <span className="text-slate-500 text-xs hidden sm:inline">—</span>
                      <span className="text-slate-300 text-xs sm:text-sm capitalize">{item.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`font-mono font-semibold text-xs sm:text-sm shrink-0 ${TX_COLOR[item.type] || 'text-white'}`}>
                    {TX_SIGN[item.type] || ''}{item.amount?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
