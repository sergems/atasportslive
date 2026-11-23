import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpRight, CheckCircle2, Clock, Smartphone, Bitcoin,
  Lock, RefreshCw, Inbox, AlertTriangle, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  btc_binance: 'Bitcoin (Binance)',
};
const METHOD_ICONS: Record<string, React.ElementType> = {
  mtn_momo: Smartphone,
  airtel_money: Smartphone,
  btc_binance: Bitcoin,
};

async function fetchApproved() {
  const res = await fetch('/api/admin/approved-withdrawals', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
  return res.json() as Promise<any[]>;
}

async function fetchPaidHistory() {
  const res = await fetch('/api/admin/withdrawal-history?limit=50&status=completed', { headers: authHeaders() });
  if (!res.ok) return [] as any[];
  return res.json() as Promise<any[]>;
}

async function markPaid(id: number) {
  const res = await fetch(`/api/wallet/finance/mark-paid/${id}`, { method: 'PATCH', headers: authHeaders() });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Failed');
  return d;
}

function waitingTime(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function PaymentCard({ tx, onPaid }: { tx: any; onPaid: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const MethodIcon = METHOD_ICONS[tx.paymentMethod] ?? Smartphone;

  const markPaidMut = useMutation({
    mutationFn: () => markPaid(tx.id),
    onSuccess: () => { toast.success('Payment confirmed — user notified.'); onPaid(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="h-0.5 bg-teal-500" />
      <div className="px-3 py-2.5">
        {/* Compact identity + amount */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 text-[11px] font-bold text-white">
            {tx.userFullName?.charAt(0) ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-xs truncate">{tx.userFullName ?? `User #${tx.userId}`}</div>
            <div className="text-slate-500 text-[11px] truncate">{tx.userEmail}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-white font-mono font-bold text-sm">${Number(tx.amount).toFixed(2)}</div>
            <div className="text-slate-600 text-[10px]">Waiting {waitingTime(tx.createdAt)}</div>
          </div>
        </div>

        {/* Payout detail + action on one line */}
        <div className="mt-2 flex items-center gap-2 rounded bg-slate-900/60 px-2 py-1.5">
          <Lock className="h-3 w-3 text-slate-500 shrink-0" />
          <MethodIcon className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <span className="text-slate-400 text-[11px] shrink-0">{METHOD_LABELS[tx.paymentMethod] ?? tx.paymentMethod}</span>
          <span className="font-mono text-[11px] text-teal-300 truncate" title={tx.reference}>{tx.reference}</span>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="shrink-0 rounded border border-teal-500/40 bg-teal-500/15 px-2 py-1 text-[11px] font-semibold text-teal-400 hover:bg-teal-500/25 transition-colors"
            >
              Mark paid
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-[10px] text-slate-400 hidden sm:inline">Paid?</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded px-1.5 py-1 text-[11px] text-slate-400 hover:text-white"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => markPaidMut.mutate()}
                disabled={markPaidMut.isPending}
                className="rounded bg-teal-500 px-2 py-1 text-[11px] font-bold text-slate-950 disabled:opacity-50"
              >
                {markPaidMut.isPending ? '…' : 'Yes, paid'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FinanceWithdrawals() {
  useEffect(() => { document.title = 'Payment Queue - Finance'; }, []);

  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'queue' | 'history'>('queue');

  const { data: approved = [], isLoading, dataUpdatedAt, refetch, isRefetching } = useQuery({
    queryKey: ['finance-approved'],
    queryFn: fetchApproved,
    refetchInterval: 30_000,
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['finance-paid-history'],
    queryFn: fetchPaidHistory,
    enabled: tab === 'history',
    staleTime: 30_000,
  });

  const paidHistory: any[] = (Array.isArray(historyData) ? historyData : [])
    .filter((t: any) => t.status === 'completed');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['finance-approved'] });
    queryClient.invalidateQueries({ queryKey: ['finance-stats'] });
    queryClient.invalidateQueries({ queryKey: ['finance-approved-count'] });
    queryClient.invalidateQueries({ queryKey: ['finance-paid-history'] });
  };

  const totalValue = approved.reduce((s: number, tx: any) => s + Number(tx.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="h-6 w-6 text-amber-400" /> Payment Queue
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Manually pay approved withdrawals and confirm</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching} className="text-slate-400 hover:text-white gap-1.5">
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('queue')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'queue' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
        >
          <Clock className="h-3.5 w-3.5" />
          Payment Queue
          {approved.length > 0 && (
            <span className="ml-1 min-w-[18px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
              {approved.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <History className="h-3.5 w-3.5" />
          Paid History
        </button>
      </div>

      {tab === 'queue' && (
        <>
          {/* Queue stats */}
          {approved.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-slate-900 border-primary/20">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="text-2xl font-bold text-amber-400">{approved.length}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Awaiting payment</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-primary/20">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="text-2xl font-bold font-mono text-white">${totalValue.toFixed(2)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Total to pay out</div>
                </CardContent>
              </Card>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 bg-slate-800 rounded-lg" />)}
            </div>
          ) : approved.length === 0 ? (
            <Card className="bg-slate-900 border-primary/20">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <Inbox className="h-10 w-10 text-slate-700" />
                <p className="text-slate-400 font-medium">Queue is clear</p>
                <p className="text-slate-600 text-sm">No approved withdrawals waiting for payment.</p>
                {dataUpdatedAt > 0 && <p className="text-slate-700 text-xs mt-1">Last checked {new Date(dataUpdatedAt).toLocaleTimeString()}</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {approved.map((tx: any) => <PaymentCard key={tx.id} tx={tx} onPaid={invalidate} />)}
            </div>
          )}

          {approved.length > 0 && (
            <p className="text-center text-xs text-slate-600">
              Auto-refreshes every 30 seconds · Last updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '–'}
            </p>
          )}
        </>
      )}

      {tab === 'history' && (
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-400" /> Payment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800 rounded" />)}</div>
            ) : !paidHistory.length ? (
              <p className="text-slate-500 text-sm text-center py-8">No completed payments yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">User</th>
                    <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs hidden sm:table-cell">Method · Account</th>
                    <th className="text-right py-2 px-2 text-slate-500 font-medium text-xs">Amount</th>
                    <th className="text-right py-2 px-2 text-slate-500 font-medium text-xs hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paidHistory.map((tx: any) => {
                    const Icon = METHOD_ICONS[tx.paymentMethod] ?? Smartphone;
                    return (
                      <tr key={tx.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                        <td className="py-2.5 px-2">
                          <div className="text-white text-sm font-medium">{tx.userFullName ?? `User #${tx.userId}`}</div>
                          <div className="text-slate-600 text-[10px] font-mono">{tx.transactionId}</div>
                        </td>
                        <td className="py-2.5 px-2 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Icon className="h-3 w-3 text-teal-400" />
                            {METHOD_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
                          </div>
                          <div className="text-slate-600 text-[10px] font-mono">{tx.reference}</div>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="text-teal-400 font-mono font-semibold">${Number(tx.amount).toFixed(2)}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right hidden md:table-cell">
                          <span className="text-slate-500 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
