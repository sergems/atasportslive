import React, { useEffect } from 'react';
import { useGetAdminStats, useGetRecentActivity } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { Users, Wallet, TrendingUp, Radio, Trophy, ArrowUpRight, Clock, ChevronRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

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

export default function AdminDashboard() {
  useEffect(() => { document.title = 'Admin Dashboard - ATA Platform'; }, []);

  const { data: stats, isLoading } = useGetAdminStats();
  const { data: activity } = useGetRecentActivity({ limit: 10 });
  const { data: pipeline, isLoading: pipelineLoading } = useWithdrawalPipeline();

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
