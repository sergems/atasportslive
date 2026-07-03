import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListTransactions } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History, ArrowDownCircle, ArrowUpCircle, Trophy, PlayCircle,
  Gift, ShieldCheck, CreditCard, RefreshCw, Wallet,
  TrendingUp, TrendingDown, ChevronDown
} from 'lucide-react';

// ── Type metadata ─────────────────────────────────────────────────────────

const TX_META: Record<string, { label: string; sign: '+' | '-'; color: string; iconBg: string; icon: React.ElementType }> = {
  deposit:        { label: 'Deposit',          sign: '+', color: 'text-teal-400',   iconBg: 'bg-teal-500/10 border-teal-500/30',   icon: ArrowDownCircle },
  withdrawal:     { label: 'Withdrawal',       sign: '-', color: 'text-red-400',    iconBg: 'bg-red-500/10 border-red-500/30',     icon: ArrowUpCircle },
  bet_stake:      { label: 'Bet Placed',       sign: '-', color: 'text-amber-400',  iconBg: 'bg-amber-500/10 border-amber-500/30', icon: Trophy },
  bet_win:        { label: 'Bet Won',          sign: '+', color: 'text-teal-400',   iconBg: 'bg-teal-500/10 border-teal-500/30',   icon: Trophy },
  bet_refund:     { label: 'Bet Refund',       sign: '+', color: 'text-sky-400',    iconBg: 'bg-sky-500/10 border-sky-500/30',     icon: RefreshCw },
  stream_access:  { label: 'Stream / Sub',     sign: '-', color: 'text-violet-400', iconBg: 'bg-violet-500/10 border-violet-500/30', icon: PlayCircle },
  brokerage_fee:  { label: 'Brokerage Fee',    sign: '-', color: 'text-slate-400',  iconBg: 'bg-slate-500/10 border-slate-500/30', icon: ShieldCheck },
  voucher_redeem: { label: 'Voucher Redeemed', sign: '+', color: 'text-emerald-400',iconBg: 'bg-emerald-500/10 border-emerald-500/30', icon: Gift },
  admin_credit:   { label: 'Admin Credit',     sign: '+', color: 'text-teal-400',   iconBg: 'bg-teal-500/10 border-teal-500/30',   icon: CreditCard },
  admin_debit:    { label: 'Admin Debit',      sign: '-', color: 'text-red-400',    iconBg: 'bg-red-500/10 border-red-500/30',     icon: CreditCard },
};

const FILTER_OPTIONS = [
  { key: 'all',           label: 'All' },
  { key: 'deposit',       label: 'Deposits' },
  { key: 'withdrawal',    label: 'Withdrawals' },
  { key: 'bet_stake',     label: 'Bets' },
  { key: 'bet_win',       label: 'Winnings' },
  { key: 'stream_access', label: 'Streams' },
  { key: 'bet_refund',    label: 'Refunds' },
  { key: 'voucher_redeem',label: 'Vouchers' },
];

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  pending:   'text-amber-400 bg-amber-500/10 border-amber-500/30',
  failed:    'text-red-400 bg-red-500/10 border-red-500/30',
  rejected:  'text-red-400 bg-red-500/10 border-red-500/30',
};

function groupByDate(txs: any[]): { label: string; items: any[] }[] {
  const map = new Map<string, any[]>();
  for (const tx of txs) {
    const d = new Date(tx.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(tx);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ── Component ─────────────────────────────────────────────────────────────

export default function Transactions() {
  useEffect(() => { document.title = 'Transactions — ATA Sports Live'; }, []);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const { data: txData, isLoading } = useListTransactions({ limit: 200 });

  const all = txData?.transactions ?? [];
  const filtered = typeFilter === 'all' ? all : all.filter((tx: any) => tx.type === typeFilter);
  const displayed = showAll ? filtered : filtered.slice(0, 40);

  const totalIn  = all.filter((t: any) => TX_META[t.type]?.sign === '+').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalOut = all.filter((t: any) => TX_META[t.type]?.sign === '-').reduce((s: number, t: any) => s + Number(t.amount), 0);

  const groups = groupByDate(displayed);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-900 px-6 py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-2">
            <History className="h-3 w-3" /> Wallet Activity
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transactions</h1>
          <p className="text-slate-400 text-sm mt-0.5">Your complete wallet history.</p>
        </div>

        {/* Summary strip */}
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2.5 text-center">
            <Wallet className="h-3.5 w-3.5 mx-auto mb-1 text-slate-400" />
            <div className="font-bold font-mono text-sm text-white">{all.length}</div>
            <div className="text-slate-500 text-[10px] mt-0.5">Total</div>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-teal-500/20 px-3 py-2.5 text-center">
            <TrendingUp className="h-3.5 w-3.5 mx-auto mb-1 text-teal-400" />
            <div className="font-bold font-mono text-sm text-teal-400">${totalIn.toFixed(2)}</div>
            <div className="text-slate-500 text-[10px] mt-0.5">Total In</div>
          </div>
          <div className="rounded-xl bg-slate-800/60 border border-red-500/20 px-3 py-2.5 text-center">
            <TrendingDown className="h-3.5 w-3.5 mx-auto mb-1 text-red-400" />
            <div className="font-bold font-mono text-sm text-red-400">${totalOut.toFixed(2)}</div>
            <div className="text-slate-500 text-[10px] mt-0.5">Total Out</div>
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTypeFilter(key); setShowAll(false); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              typeFilter === key
                ? 'bg-teal-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'
            }`}
          >
            {key !== 'all' && TX_META[key] && React.createElement(TX_META[key].icon, { className: 'h-3 w-3' })}
            {label}
          </button>
        ))}
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="w-14 h-14 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
            <History className="h-7 w-7 text-teal-500/40" />
          </div>
          <p className="text-white font-semibold mb-1">No transactions found</p>
          <p className="text-slate-500 text-sm mb-5">
            {typeFilter === 'all' ? "You haven't made any transactions yet." : `No ${typeFilter.replace(/_/g, ' ')} transactions.`}
          </p>
          <Link href="/wallet">
            <div className="inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-sm px-4 py-2 transition-all cursor-pointer">
              <Wallet className="h-4 w-4" /> Go to Wallet
            </div>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          {groups.map(({ label, items }, gi) => (
            <div key={label}>
              {/* Date divider */}
              <div className={`px-5 py-2 flex items-center gap-3 ${gi > 0 ? 'border-t border-slate-800' : ''} bg-slate-800/30`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-600">{items.length} tx</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-800/60">
                {items.map((tx: any) => {
                  const meta = TX_META[tx.type] ?? {
                    label: tx.type.replace(/_/g, ' '),
                    sign: '+' as const,
                    color: 'text-white',
                    iconBg: 'bg-slate-700 border-slate-600',
                    icon: CreditCard,
                  };
                  const Icon = meta.icon;
                  const statusStyle = STATUS_STYLE[tx.status] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30';

                  return (
                    <div key={tx.id} className="group flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                      {/* Icon */}
                      <div className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${meta.iconBg}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{meta.label}</span>
                          <span className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${statusStyle}`}>
                            {tx.status}
                          </span>
                        </div>
                        {tx.description ? (
                          <p className="text-slate-500 text-xs mt-0.5 truncate">{tx.description}</p>
                        ) : (
                          <p className="text-slate-600 text-[10px] mt-0.5 font-mono">{tx.transactionId}</p>
                        )}
                        <p className="text-slate-600 text-[10px] mt-0.5">
                          {new Date(tx.createdAt).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="shrink-0 text-right">
                        <div className={`font-mono font-bold text-sm ${meta.color}`}>
                          {meta.sign}${Number(tx.amount).toFixed(2)}
                        </div>
                        <div className="text-slate-600 text-[10px] uppercase tracking-wider mt-0.5">
                          {tx.paymentMethod?.replace(/_/g, ' ') ?? ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {!showAll && filtered.length > 40 && (
            <div className="border-t border-slate-800 px-5 py-3 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
                Show all {filtered.length} transactions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
