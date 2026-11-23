import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListTransactions } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  History, ArrowDownCircle, ArrowUpCircle, Trophy, PlayCircle,
  Gift, ShieldCheck, CreditCard, RefreshCw, Wallet,
  TrendingUp, TrendingDown, ChevronDown
} from 'lucide-react';

const TX_META: Record<string, { label: string; sign: '+' | '-'; color: string; iconBg: string; icon: React.ElementType }> = {
  deposit:        { label: 'Deposit',          sign: '+', color: 'text-teal-400',   iconBg: 'bg-teal-500/10 border-teal-500/30',   icon: ArrowDownCircle },
  withdrawal:     { label: 'Withdrawal',       sign: '-', color: 'text-red-400',    iconBg: 'bg-red-500/10 border-red-500/30',     icon: ArrowUpCircle },
  bet_stake:      { label: 'Prediction Placed', sign: '-', color: 'text-amber-400',  iconBg: 'bg-amber-500/10 border-amber-500/30', icon: Trophy },
  bet_win:        { label: 'Bet Won',          sign: '+', color: 'text-teal-400',   iconBg: 'bg-teal-500/10 border-teal-500/30',   icon: Trophy },
  bet_refund:     { label: 'Bet Refund',       sign: '+', color: 'text-sky-400',    iconBg: 'bg-sky-500/10 border-sky-500/30',     icon: RefreshCw },
  stream_access:  { label: 'Stream / Sub',     sign: '-', color: 'text-violet-400', iconBg: 'bg-violet-500/10 border-violet-500/30', icon: PlayCircle },
  brokerage_fee:  { label: 'Brokerage Fee',    sign: '-', color: 'text-slate-400',  iconBg: 'bg-slate-500/10 border-slate-500/30', icon: ShieldCheck },
  voucher_redeem: { label: 'Voucher Redeemed', sign: '+', color: 'text-emerald-400',iconBg: 'bg-emerald-500/10 border-emerald-500/30', icon: Gift },
  bonus_deposit:  { label: 'Bonus Deposit',   sign: '+', color: 'text-amber-400',  iconBg: 'bg-amber-500/10 border-amber-500/30',   icon: Gift },
  admin_credit:   { label: 'Admin Credit',     sign: '+', color: 'text-teal-400',   iconBg: 'bg-teal-500/10 border-teal-500/30',   icon: CreditCard },
  admin_debit:    { label: 'Admin Debit',      sign: '-', color: 'text-red-400',    iconBg: 'bg-red-500/10 border-red-500/30',     icon: CreditCard },
};

const FILTER_OPTIONS = [
  { key: 'all',           label: 'All' },
  { key: 'deposit',       label: 'Deposits' },
  { key: 'withdrawal',    label: 'Withdrawals' },
  { key: 'bet_stake',     label: 'Predictions' },
  { key: 'bet_win',       label: 'Winnings' },
  { key: 'stream_access', label: 'Streams' },
  { key: 'bet_refund',    label: 'Refunds' },
  { key: 'bonus_deposit', label: 'Bonus Deposits' },
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

export default function Transactions() {
  useEffect(() => { document.title = 'Transactions — ATA Sports Live'; }, []);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const { data: txData, isLoading } = useListTransactions({ limit: 200 });

  const all = txData?.transactions ?? [];
  const filtered = typeFilter === 'all' ? all : all.filter((tx: any) => tx.type === typeFilter);
  const displayed = showAll ? filtered : filtered.slice(0, 40);

  const totalIn = all.filter((t: any) => TX_META[t.type]?.sign === '+').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalOut = all.filter((t: any) => TX_META[t.type]?.sign === '-').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const groups = groupByDate(displayed);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 px-6 py-8 shadow-2xl shadow-black/30 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Wallet activity</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-[1.05] text-white">Transactions</h1>
          <p className="mt-3 max-w-md text-base leading-relaxed text-slate-400">Your complete wallet history, all in one place.</p>
        </div>

        <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total entries', value: all.length,        icon: Wallet,      color: 'text-white' },
            { label: 'Total in',      value: `$${totalIn.toFixed(2)}`,  icon: TrendingUp,   color: 'text-teal-400' },
            { label: 'Total out',     value: `$${totalOut.toFixed(2)}`, icon: TrendingDown, color: 'text-red-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${color}`}>{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTypeFilter(key); setShowAll(false); }}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              typeFilter === key ? 'bg-teal-500 text-slate-950' : 'border border-slate-800 bg-slate-900/70 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {key !== 'all' && TX_META[key] && React.createElement(TX_META[key].icon, { className: 'h-3.5 w-3.5' })}
            {label}
          </button>
        ))}
      </div>

      {/* ── List ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-20 rounded-2xl bg-slate-800/50" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-teal-500/20 bg-teal-500/10">
            <History className="h-8 w-8 text-teal-500/40" />
          </div>
          <p className="mt-4 text-lg font-bold text-white">No transactions found</p>
          <p className="mt-1 text-sm text-slate-500">
            {typeFilter === 'all' ? "You haven't made any transactions yet." : `No ${typeFilter.replace(/_/g, ' ')} transactions.`}
          </p>
          <Link href="/wallet">
            <span className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-400 cursor-pointer">
              <Wallet className="h-4 w-4" /> Go to Wallet
            </span>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          {groups.map(({ label, items }, gi) => (
            <div key={label}>
              <div className={`flex items-center gap-3 bg-slate-800/30 px-5 py-3 ${gi > 0 ? 'border-t border-slate-800' : ''}`}>
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-xs text-slate-600">{items.length} tx</span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {items.map((tx: any) => {
                  const meta = TX_META[tx.type] ?? {
                    label: tx.type.replace(/_/g, ' '), sign: '+' as const, color: 'text-white',
                    iconBg: 'bg-slate-700 border-slate-600', icon: CreditCard,
                  };
                  const Icon = meta.icon;
                  const statusStyle = STATUS_STYLE[tx.status] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30';
                  return (
                    <div key={tx.id} className="flex items-center gap-4 px-5 py-5 transition hover:bg-slate-800/30">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${meta.iconBg}`}>
                        <Icon className={`h-5 w-5 ${meta.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-white">{meta.label}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyle}`}>{tx.status}</span>
                        </div>
                        {tx.description ? (
                          <p className="mt-1 truncate text-sm text-slate-400">{tx.description}</p>
                        ) : (
                          <p className="mt-1 truncate font-mono text-xs text-slate-600">{tx.transactionId}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-600">
                          {new Date(tx.createdAt).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-base font-bold tabular-nums ${meta.color}`}>{meta.sign}${Number(tx.amount).toFixed(2)}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-600">{tx.paymentMethod?.replace(/_/g, ' ') ?? ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!showAll && filtered.length > 40 && (
            <div className="border-t border-slate-800 px-5 py-4 text-center">
              <button onClick={() => setShowAll(true)} className="inline-flex items-center gap-2 text-sm font-bold text-teal-400 hover:text-teal-300">
                <ChevronDown className="h-4 w-4" /> Show all {filtered.length} transactions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
