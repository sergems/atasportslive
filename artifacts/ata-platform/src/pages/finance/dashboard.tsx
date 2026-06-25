import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import {
  ArrowUpRight, CheckCircle2, Clock, DollarSign,
  Smartphone, Bitcoin, TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  btc_binance: 'Bitcoin',
};
const METHOD_ICONS: Record<string, React.ElementType> = {
  mtn_momo: Smartphone,
  airtel_money: Smartphone,
  btc_binance: Bitcoin,
};

export default function FinanceDashboard() {
  useEffect(() => { document.title = 'Finance Dashboard - ATA'; }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['finance-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/finance-stats', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{
        pendingCount: number;
        pendingValue: number;
        paidToday: number;
        paidTotal: number;
        paidCount: number;
        recentPaid: any[];
      }>;
    },
    refetchInterval: 30_000,
  });

  const stats = [
    {
      label: 'Awaiting Payment',
      value: data?.pendingCount ?? 0,
      sub: `$${(data?.pendingValue ?? 0).toFixed(2)} total`,
      color: 'text-amber-400',
      icon: Clock,
      href: '/finance/withdrawals',
    },
    {
      label: 'Paid Today',
      value: `$${(data?.paidToday ?? 0).toFixed(2)}`,
      sub: 'USD sent today',
      color: 'text-teal-400',
      icon: CheckCircle2,
    },
    {
      label: 'Total Paid (All Time)',
      value: `$${(data?.paidTotal ?? 0).toFixed(2)}`,
      sub: `${data?.paidCount ?? 0} payments`,
      color: 'text-white',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-teal-400" /> Finance Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Payment operations overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, sub, color, icon: Icon, href }) => (
          <Card key={label} className="bg-slate-900 border-primary/20">
            <CardContent className="pt-5 pb-5 px-5">
              {isLoading ? (
                <Skeleton className="h-8 w-24 bg-slate-800 mb-1" />
              ) : (
                <div className={`text-2xl font-bold font-mono ${color}`}>
                  {typeof value === 'number' && value > 999 ? value.toLocaleString() : value}
                </div>
              )}
              <div className="text-slate-400 text-sm mt-0.5">{label}</div>
              <div className="text-slate-600 text-xs mt-0.5">{sub}</div>
              {href && data?.pendingCount ? (
                <Link href={href}>
                  <span className="text-xs text-teal-400 hover:text-teal-300 mt-2 inline-flex items-center gap-1">
                    View queue <ArrowUpRight className="h-3 w-3" />
                  </span>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending alert */}
      {!isLoading && (data?.pendingCount ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              <strong>{data!.pendingCount} withdrawal{data!.pendingCount > 1 ? 's' : ''}</strong> approved by admin and awaiting payment (${data!.pendingValue.toFixed(2)} total).
            </span>
          </div>
          <Link href="/finance/withdrawals">
            <span className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap ml-3">
              Pay now →
            </span>
          </Link>
        </div>
      )}

      {/* Recent paid history */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-teal-400" /> Recent Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800 rounded" />)}</div>
          ) : !data?.recentPaid?.length ? (
            <p className="text-slate-500 text-sm text-center py-6">No payments made yet.</p>
          ) : (
            <div className="space-y-1">
              {data.recentPaid.map((tx: any) => {
                const Icon = METHOD_ICONS[tx.paymentMethod] ?? Smartphone;
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-teal-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate">{tx.userFullName ?? `User #${tx.userId}`}</div>
                        <div className="text-slate-500 text-xs font-mono truncate">{METHOD_LABELS[tx.paymentMethod] ?? tx.paymentMethod} · {tx.reference}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-teal-400 font-mono font-semibold">${Number(tx.amount).toFixed(2)}</div>
                      <div className="text-slate-600 text-[10px]">{new Date(tx.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
