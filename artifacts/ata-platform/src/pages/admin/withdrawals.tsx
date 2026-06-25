import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowUpRight, CheckCircle, XCircle, Clock, Smartphone, Bitcoin,
  RefreshCw, AlertTriangle, Inbox, ShieldCheck, Lock,
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

async function fetchPending() {
  const res = await fetch('/api/admin/pending-withdrawals', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load');
  return res.json() as Promise<any[]>;
}

async function approveWithdrawal(id: number) {
  const res = await fetch(`/api/wallet/admin/approve-withdrawal/${id}`, {
    method: 'PATCH', headers: authHeaders(),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Failed');
  return d;
}

async function rejectWithdrawal(id: number, note: string) {
  const res = await fetch(`/api/wallet/admin/reject-withdrawal/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ note }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Failed');
  return d;
}

function waitingTime(createdAt: string): { label: string; urgency: 'low' | 'medium' | 'high' } {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (days > 0) label = `${days}d ${hours % 24}h`;
  else if (hours > 0) label = `${hours}h ${mins % 60}m`;
  else label = `${mins}m`;

  const urgency = days > 0 ? 'high' : hours >= 1 ? 'medium' : 'low';
  return { label, urgency };
}

const URGENCY_STYLES = {
  low:    { badge: 'bg-teal-500/15 text-teal-400 border-teal-500/30',   icon: 'text-teal-400',   bar: 'bg-teal-500' },
  medium: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: 'text-amber-400',  bar: 'bg-amber-500' },
  high:   { badge: 'bg-red-500/15 text-red-400 border-red-500/30',       icon: 'text-red-400',    bar: 'bg-red-500' },
};

function WaitingBadge({ createdAt }: { createdAt: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { label, urgency } = waitingTime(createdAt);
  const s = URGENCY_STYLES[urgency];

  return (
    <Badge className={`border text-xs font-mono flex items-center gap-1 ${s.badge}`}>
      <Clock className={`h-3 w-3 ${s.icon}`} />
      {label}
    </Badge>
  );
}

function WithdrawalRow({ tx, onDone }: { tx: any; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const approveMut = useMutation({
    mutationFn: () => approveWithdrawal(tx.id),
    onSuccess: () => { toast.success('Withdrawal approved — funds sent.'); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectWithdrawal(tx.id, note),
    onSuccess: () => { toast.success('Withdrawal rejected — funds returned to user.'); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  const { urgency } = waitingTime(tx.createdAt);
  const styles = URGENCY_STYLES[urgency];
  const MethodIcon = METHOD_ICONS[tx.paymentMethod] ?? Smartphone;

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Urgency bar */}
      <div className={`h-0.5 ${styles.bar}`} />

      <div className="p-4 space-y-3">
        {/* Row 1: User + waiting */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 text-sm font-bold text-white">
              {tx.userFullName?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-sm truncate">{tx.userFullName ?? `User #${tx.userId}`}</div>
              <div className="text-slate-500 text-xs font-mono">{tx.transactionId}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WaitingBadge createdAt={tx.createdAt} />
            <div className="text-right">
              <div className="text-white font-bold font-mono text-xl leading-tight">${Number(tx.amount).toFixed(2)}</div>
              <div className="text-slate-500 text-[10px]">USD</div>
            </div>
          </div>
        </div>

        {/* Row 2: Payout method */}
        <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
          <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <MethodIcon className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <span className="text-xs text-slate-300 font-medium">{METHOD_LABELS[tx.paymentMethod] ?? tx.paymentMethod}</span>
          <span className="text-slate-500 text-xs">·</span>
          <span className="text-xs text-slate-400 font-mono">{tx.reference}</span>
          <ShieldCheck className="h-3 w-3 text-teal-500/70 ml-auto shrink-0" />
        </div>

        {/* Row 3: Submitted at */}
        <div className="text-[10px] text-slate-600">
          Submitted {new Date(tx.createdAt).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>

        {/* Row 4: Actions */}
        {!rejecting ? (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending || rejectMut.isPending}
              className="flex-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/40 font-semibold h-9 gap-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              {approveMut.isPending ? 'Approving…' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRejecting(true)}
              disabled={approveMut.isPending}
              className="flex-1 text-red-400 hover:bg-red-500/10 border border-red-500/20 h-9 gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <Textarea
              placeholder="Rejection reason (optional — sent to user)…"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white text-xs resize-none h-16 placeholder:text-slate-600"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm"
                onClick={() => { setRejecting(false); setNote(''); }}
                className="flex-1 text-slate-400 h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => rejectMut.mutate()}
                disabled={rejectMut.isPending}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-semibold h-8 text-xs gap-1"
              >
                <XCircle className="h-3.5 w-3.5" />
                {rejectMut.isPending ? 'Rejecting…' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminWithdrawals() {
  useEffect(() => { document.title = 'Withdrawal Queue - Admin'; }, []);

  const queryClient = useQueryClient();
  const { data, isLoading, dataUpdatedAt, refetch, isRefetching } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: fetchPending,
    refetchInterval: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });

  const withdrawals: any[] = data ?? [];
  const totalPending = withdrawals.length;
  const totalValue = withdrawals.reduce((s, tx) => s + Number(tx.amount), 0);
  const highUrgency = withdrawals.filter(tx => waitingTime(tx.createdAt).urgency === 'high').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="h-6 w-6 text-amber-400" />
            Withdrawal Queue
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Review and authorize pending payout requests
          </p>
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="text-slate-400 hover:text-white gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-900 border-primary/20">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="text-2xl font-bold text-amber-400">{totalPending}</div>
            <div className="text-xs text-slate-500 mt-0.5">Pending requests</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-primary/20">
          <CardContent className="pt-4 pb-4 px-4">
            <div className="text-2xl font-bold font-mono text-white">${totalValue.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total value pending</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-primary/20">
          <CardContent className="pt-4 pb-4 px-4">
            <div className={`text-2xl font-bold ${highUrgency > 0 ? 'text-red-400' : 'text-slate-600'}`}>{highUrgency}</div>
            <div className="text-xs text-slate-500 mt-0.5">Waiting &gt; 24 hours</div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium text-slate-400">Wait time:</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" /> &lt; 1 hour</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 1–24 hours</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> &gt; 24 hours</span>
      </div>

      {/* Queue */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 bg-slate-800 rounded-xl" />)}
        </div>
      ) : withdrawals.length === 0 ? (
        <Card className="bg-slate-900 border-primary/20">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Inbox className="h-10 w-10 text-slate-700" />
            <p className="text-slate-400 font-medium">No pending withdrawals</p>
            <p className="text-slate-600 text-sm">All requests have been processed.</p>
            {dataUpdatedAt > 0 && (
              <p className="text-slate-700 text-xs mt-1">
                Last checked {new Date(dataUpdatedAt).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {highUrgency > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span><strong>{highUrgency} request{highUrgency > 1 ? 's' : ''}</strong> {highUrgency > 1 ? 'have' : 'has'} been waiting over 24 hours.</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sort: high urgency first */}
            {[...withdrawals]
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
              .map(tx => (
                <WithdrawalRow key={tx.id} tx={tx} onDone={invalidate} />
              ))
            }
          </div>
          <p className="text-center text-xs text-slate-600">
            Auto-refreshes every 30 seconds · Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </div>
  );
}
