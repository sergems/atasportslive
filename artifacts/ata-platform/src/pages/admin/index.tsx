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
  // Include seconds so Safari's Date constructor parses correctly (T00:00 alone can fail)
  const start = new Date(`${dateStr}T${timeStr || '00:00'}:00`);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white tracking-tight truncate">Dashboard</h1>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {statCards.slice(0, 4).map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="py-3 px-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <div className="text-slate-400 text-[10px] font-medium leading-tight uppercase tracking-wider">{label}</div>
              </div>
              {isLoading ? <Skeleton className="h-6 w-14 bg-slate-800 mt-1" /> : (
                <div className={`text-xl font-bold font-mono ${color} truncate`}>{value ?? '—'}</div>
              )}
              {sub && <div className="text-slate-600 text-[10px] mt-0.5">{sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Settlement Due */}
        {(settlementLoading || settlementGames.length > 0) && (
          <Card className={`bg-slate-900 ${settlementGames.length > 0 ? 'border-orange-500/40' : 'border-slate-800'}`}>
            <CardHeader className="py-2.5 px-3 border-b border-slate-800 flex flex-row items-center justify-between">
              <CardTitle className="text-white text-xs uppercase tracking-wider flex items-center gap-2">
                <Gavel className="h-3.5 w-3.5 text-orange-400" />
                Settlement Due
                {settlementGames.length > 0 && (
                  <span className="min-w-[18px] h-4 px-1 rounded-full bg-orange-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                    {settlementGames.length}
                  </span>
                )}
              </CardTitle>
              <Link href="/admin/games">
                <span className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors cursor-pointer">
                  View All
                </span>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {settlementLoading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-10 w-full rounded bg-slate-800" />
                  <Skeleton className="h-10 w-full rounded bg-slate-800" />
                </div>
              ) : settlementGames.length === 0 ? (
                <div className="flex items-center gap-2 text-slate-500 text-xs py-4 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
                  No live games awaiting settlement.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {settlementGames.map((game: any) => (
                    <SettleRow key={game.id} game={game} onSettled={invalidateGames} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Withdrawal Pipeline */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="py-2.5 px-3 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" /> Withdrawals
            </CardTitle>
            <Link href="/admin/withdrawals">
              <span className="text-[10px] text-teal-400 hover:text-teal-300 transition-colors cursor-pointer">
                Manage
              </span>
            </Link>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/admin/withdrawals" className="flex-1 block">
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 hover:bg-amber-500/10 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Pending</div>
                    {!pipelineLoading && (stats?.pendingWithdrawals ?? 0) > 0 && (
                      <span className="min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                        {stats!.pendingWithdrawals}
                      </span>
                    )}
                  </div>
                  {pipelineLoading ? <Skeleton className="h-5 w-12 bg-slate-800" /> : (
                    <div className="text-lg font-bold font-mono text-white leading-none">{stats?.pendingWithdrawals ?? 0}</div>
                  )}
                </div>
              </Link>

              <Link href="/admin/withdrawals" className="flex-1 block">
                <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-2.5 hover:bg-blue-500/10 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Finance</div>
                    {!pipelineLoading && (pipeline?.approvedCount ?? 0) > 0 && (
                      <span className="min-w-[18px] h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {pipeline!.approvedCount}
                      </span>
                    )}
                  </div>
                  {pipelineLoading ? <Skeleton className="h-5 w-12 bg-slate-800" /> : (
                    <div className="flex items-baseline gap-2">
                      <div className="text-lg font-bold font-mono text-white leading-none">{pipeline?.approvedCount ?? 0}</div>
                      {(pipeline?.approvedValue ?? 0) > 0 && <div className="text-[10px] text-slate-500 font-mono">${(pipeline!.approvedValue).toFixed(2)}</div>}
                    </div>
                  )}
                </div>
              </Link>

              <div className="flex-1 rounded-lg border border-teal-500/20 bg-teal-500/5 p-2.5">
                <div className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1">Paid Today</div>
                {pipelineLoading ? <Skeleton className="h-5 w-12 bg-slate-800" /> : (
                  <div className="flex items-baseline gap-2">
                    <div className="text-lg font-bold font-mono text-teal-400 leading-none">${(pipeline?.paidToday ?? 0).toFixed(2)}</div>
                    {(pipeline?.paidCount ?? 0) > 0 && <div className="text-[10px] text-slate-500 font-mono">{pipeline!.paidCount} tx</div>}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="py-2.5 px-3 border-b border-slate-800">
          <CardTitle className="text-white text-xs uppercase tracking-wider">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!activity || activity.length === 0 ? (
            <p className="text-slate-500 text-xs py-4 px-3">No recent activity.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {activity.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-slate-800 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-400">{item.userFullName?.charAt(0) || '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-[11px] font-medium truncate">{item.userFullName || `User #${item.userId}`}</span>
                        <span className="text-slate-400 text-[10px] capitalize truncate">{item.type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <span className={`font-mono font-semibold text-[11px] shrink-0 ${TX_COLOR[item.type] || 'text-white'}`}>
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
