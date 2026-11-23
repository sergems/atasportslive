import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListMyBets } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy, Swords, CheckCircle2, XCircle, Timer, RefreshCw, ChevronRight, Target,
  DollarSign, BarChart3, Flame
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',   icon: Timer },
  matched:   { label: 'Matched',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',     icon: RefreshCw },
  won:       { label: 'Won',       color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/30',     icon: CheckCircle2 },
  lost:      { label: 'Lost',      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',       icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/30',   icon: XCircle },
  refunded:  { label: 'Refunded',  color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/30',       icon: RefreshCw },
};

const FILTERS = ['all', 'pending', 'matched', 'won', 'lost', 'cancelled', 'refunded'];

function pickLabel(bet: any): string {
  if (bet.outcome === 'player_a_wins') return bet.game?.playerA ?? 'Player A';
  if (bet.outcome === 'player_b_wins') return bet.game?.playerB ?? 'Player B';
  return (bet.outcome ?? '').replace(/_/g, ' ');
}

export default function Bets() {
  useEffect(() => { document.title = 'My Predictions — ATA Sports Live'; }, []);
  const [filter, setFilter] = useState('all');

  const { data: betsData, isLoading } = useListMyBets({
    status: filter !== 'all' ? filter : undefined,
    limit: 50,
  });

  const bets = betsData?.bets ?? [];
  const allBets = betsData?.bets ?? [];
  const won = allBets.filter((b: any) => b.status === 'won').length;
  const pending = allBets.filter((b: any) => ['pending', 'matched'].includes(b.status)).length;
  const totalStaked = allBets.reduce((s: number, b: any) => s + Number(b.stake), 0);
  const winRate = allBets.length ? Math.round((won / allBets.length) * 100) : 0;

  const stats = [
    { label: 'Total',  value: betsData?.total ?? 0,        color: 'text-white',    icon: BarChart3 },
    { label: 'Won',    value: won,                          color: 'text-teal-400', icon: CheckCircle2 },
    { label: 'Active', value: pending,                      color: 'text-amber-400',icon: Flame },
    { label: 'Staked', value: `$${totalStaked.toFixed(2)}`, color: 'text-sky-400',  icon: DollarSign },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 px-6 py-8 shadow-2xl shadow-black/30 sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Prediction history</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl">My Predictions</h1>
            <p className="mt-3 max-w-md text-base leading-relaxed text-slate-400">Every pick, every result — all in one place.</p>
          </div>
          <Link href="/games">
            <span className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 active:scale-95 cursor-pointer">
              <Swords className="h-4 w-4" /> Make a prediction
            </span>
          </Link>
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${color}`}>{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const meta = STATUS_META[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold capitalize transition-all ${
                active ? 'bg-amber-500 text-slate-950' : 'border border-slate-800 bg-slate-900/70 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {f !== 'all' && meta && React.createElement(meta.icon, { className: 'h-3.5 w-3.5' })}
              {f === 'all' ? 'All' : meta?.label ?? f}
            </button>
          );
        })}
      </div>

      {/* ── List ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl bg-slate-800/50" />)}</div>
      ) : bets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10">
            <Trophy className="h-8 w-8 text-amber-500/50" />
          </div>
          <p className="mt-4 text-lg font-bold text-white">No predictions found</p>
          <p className="mt-1 text-sm text-slate-500">
            {filter === 'all' ? "You haven't made any predictions yet." : `No ${filter} predictions to show.`}
          </p>
          <Link href="/games" className="mt-6">
            <Button className="rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
              <Swords className="mr-2 h-4 w-4" /> Browse games
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bets.map((bet: any) => {
            const meta = STATUS_META[bet.status] ?? STATUS_META.cancelled;
            const StatusIcon = meta.icon;
            const pick = pickLabel(bet);
            const isWon = bet.status === 'won';

            return (
              <Link key={bet.id} href={`/games/${bet.gameId}`}>
                <div className={`group relative overflow-hidden rounded-2xl border bg-slate-900/70 transition hover:bg-slate-900 cursor-pointer ${isWon ? 'border-teal-500/30 hover:border-teal-500/60' : 'border-slate-800 hover:border-slate-600'}`}>
                  {isWon && <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-teal-500/5 to-transparent" />}
                  <div className="relative flex items-center gap-5 px-5 py-5 sm:px-6">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${meta.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-white transition group-hover:text-amber-300">
                          {bet.game?.playerA ?? '?'} <span className="font-normal text-slate-600">vs</span> {bet.game?.playerB ?? '?'}
                        </span>
                        {bet.game?.sport && (
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{bet.game.sport}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">Pick: <span className="font-medium capitalize text-slate-300">{pick}</span></p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                          <StatusIcon className="h-3 w-3" /> {meta.label}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(bet.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {bet.ticketId && <span className="hidden font-mono text-xs text-slate-700 sm:inline">{bet.ticketId}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold tabular-nums text-white">${Number(bet.stake).toFixed(2)}</p>
                      <p className="text-xs text-slate-600">stake</p>
                      {Number(bet.potentialReturn) > 0 && (
                        <p className={`mt-1 text-sm font-semibold tabular-nums ${isWon ? 'text-teal-400' : 'text-slate-400'}`}>
                          ${Number(bet.potentialReturn).toFixed(2)} <span className="font-normal text-slate-600">{isWon ? 'won' : 'payout'}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-700 transition group-hover:text-amber-400" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!isLoading && allBets.length > 0 && filter === 'all' && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
          <Target className="h-4 w-4 text-teal-500" /> Win rate: <span className="font-bold text-teal-400">{winRate}%</span>
          <span className="text-slate-700">·</span>
          <BarChart3 className="h-4 w-4 text-amber-500" /> Total potential: <span className="font-bold text-amber-400">
            ${allBets.filter((b: any) => b.status === 'won').reduce((s: number, b: any) => s + Number(b.potentialReturn), 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
