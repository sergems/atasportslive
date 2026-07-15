import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListMyBets } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy, Clock, TrendingUp, Swords, CheckCircle2,
  XCircle, Timer, RefreshCw, ChevronRight, Target,
  DollarSign, BarChart3, Flame
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────

export default function Bets() {
  useEffect(() => { document.title = 'My Predictions — ATA Sports Live'; }, []);
  const [filter, setFilter] = useState('all');

  const { data: betsData, isLoading } = useListMyBets({
    status: filter !== 'all' ? filter : undefined,
    limit: 50,
  });

  const bets = betsData?.bets ?? [];

  const allBets = betsData?.bets ?? [];
  const won       = allBets.filter((b: any) => b.status === 'won').length;
  const pending   = allBets.filter((b: any) => ['pending', 'matched'].includes(b.status)).length;
  const totalStaked = allBets.reduce((s: number, b: any) => s + Number(b.stake), 0);
  const winRate   = allBets.length ? Math.round((won / allBets.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 px-6 py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-2">
              <Trophy className="h-3 w-3" /> Prediction History
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Predictions</h1>
            <p className="text-slate-400 text-sm mt-0.5">Track all your predictions and results.</p>
          </div>
          <Link href="/games">
            <div className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs px-3.5 py-2 transition-all active:scale-95 cursor-pointer">
              <Swords className="h-3.5 w-3.5" /> Predict
            </div>
          </Link>
        </div>

        {/* Stat strip */}
        <div className="relative mt-5 grid grid-cols-4 gap-2">
          {[
            { label: 'Total',   value: betsData?.total ?? 0,               color: 'text-white',      icon: BarChart3 },
            { label: 'Won',     value: won,                                 color: 'text-teal-400',   icon: CheckCircle2 },
            { label: 'Active',  value: pending,                             color: 'text-amber-400',  icon: Flame },
            { label: 'Staked',  value: `$${totalStaked.toFixed(2)}`,        color: 'text-sky-400',    icon: DollarSign },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-3 py-2.5 text-center">
              <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${color}`} />
              <div className={`font-bold font-mono text-sm ${color}`}>{value}</div>
              <div className="text-slate-500 text-[10px] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const meta = STATUS_META[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                active
                  ? f === 'all'
                    ? 'bg-white text-slate-950'
                    : `bg-amber-500 text-slate-950`
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50'
              }`}
            >
              {f !== 'all' && meta && React.createElement(meta.icon, { className: 'h-3 w-3' })}
              {f === 'all' ? 'All' : meta?.label ?? f}
            </button>
          );
        })}
      </div>

      {/* ── Bet list ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : bets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
            <Trophy className="h-7 w-7 text-amber-500/50" />
          </div>
          <p className="text-white font-semibold mb-1">No predictions found</p>
          <p className="text-slate-500 text-sm mb-5">
            {filter === 'all' ? "You haven't made any predictions yet." : `No ${filter} predictions to show.`}
          </p>
          <Link href="/games">
            <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl">
              <Swords className="h-4 w-4 mr-2" /> Browse Games
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
                <div className={`group relative overflow-hidden rounded-2xl border bg-slate-900/70 hover:bg-slate-900 transition-all cursor-pointer ${
                  isWon ? 'border-teal-500/30 hover:border-teal-500/50' : 'border-slate-800 hover:border-slate-700'
                }`}>
                  {isWon && (
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none" />
                  )}
                  <div className="relative px-5 py-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${meta.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${meta.color}`} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-white font-semibold text-sm group-hover:text-amber-300 transition-colors">
                          {bet.game?.playerA ?? '?'} <span className="text-slate-600 font-normal">vs</span> {bet.game?.playerB ?? '?'}
                        </span>
                        {bet.game?.sport && (
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold bg-slate-800 rounded px-1.5 py-0.5">
                            {bet.game.sport}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs">
                        Pick: <span className="text-slate-300 font-medium capitalize">{pick}</span>
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {meta.label}
                        </span>
                        <span className="text-slate-600 text-[10px] flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(bet.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        {bet.ticketId && (
                          <span className="text-slate-700 text-[10px] font-mono hidden sm:inline">{bet.ticketId}</span>
                        )}
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="shrink-0 text-right">
                      <div className="text-white font-mono font-bold text-sm">${Number(bet.stake).toFixed(2)}</div>
                      <div className="text-slate-500 text-[10px]">stake</div>
                      {Number(bet.potentialReturn) > 0 && (
                        <div className={`font-mono text-xs font-semibold mt-1 ${isWon ? 'text-teal-400' : 'text-slate-400'}`}>
                          ${Number(bet.potentialReturn).toFixed(2)}
                          <span className="text-slate-600 font-normal"> {isWon ? 'won' : 'payout'}</span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-amber-400 transition-colors shrink-0 ml-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Win rate footer */}
      {!isLoading && allBets.length > 0 && filter === 'all' && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Target className="h-3.5 w-3.5 text-teal-500" />
          Win rate: <span className="text-teal-400 font-semibold">{winRate}%</span>
          <span className="text-slate-700">·</span>
          <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
          Total potential: <span className="text-amber-400 font-semibold">
            ${allBets.filter((b: any) => b.status === 'won').reduce((s: number, b: any) => s + Number(b.potentialReturn), 0).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}
