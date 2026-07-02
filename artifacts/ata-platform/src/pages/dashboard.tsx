import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useGetWallet, useListMyBets, useListTransactions } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import {
  Wallet, Activity, TrendingUp, History, Radio, Swords,
  Film, ArrowDownCircle, ChevronRight, Trophy, Clock,
  Zap, Star, Target, Gift, Copy, Check, Users
} from 'lucide-react';

interface LiveStream {
  id: number;
  title: string;
  sport: string;
  viewerCount: number | null;
  thumbnailUrl: string | null;
}

interface UpcomingGame {
  id: number;
  sport: string;
  playerA: string;
  playerB: string;
  eventDate: string;
  eventTime: string;
}

function useLive() {
  return useQuery<LiveStream | null>({
    queryKey: ['streams', 'live', 'current'],
    queryFn: async () => {
      const r = await fetch('/api/streams?status=live&limit=1');
      const d = await r.json();
      return d.streams?.[0] ?? null;
    },
    refetchInterval: 30000,
  });
}

function useUpcomingGames() {
  return useQuery<UpcomingGame[]>({
    queryKey: ['games', 'upcoming'],
    queryFn: () => fetch('/api/games/upcoming').then((r) => r.json()),
    refetchInterval: 60000,
  });
}

const BET_STATUS_STYLES: Record<string, string> = {
  won:      'bg-teal-500/15 text-teal-400 border-teal-500/30',
  lost:     'bg-red-500/15 text-red-400 border-red-500/30',
  pending:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  matched:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cancelled:'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const TX_CREDIT = new Set(['deposit', 'bet_win', 'bet_refund', 'admin_credit']);

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => { document.title = 'Dashboard — ATA Sports Live'; }, []);

  const { data: wallet, isLoading: loadingWallet } = useGetWallet();
  const { data: recentBets, isLoading: loadingBets } = useListMyBets({ limit: 5 });
  const { data: recentTx, isLoading: loadingTx } = useListTransactions({ limit: 5 });
  const { data: liveStream } = useLive();
  const { data: upcomingGames } = useUpcomingGames();

  const firstName = user?.fullName?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const nextGames = (upcomingGames ?? []).slice(0, 2);

  const referralLink = user?.referralCode
    ? `https://atasportslive.com/register?ref=${user.referralCode}`
    : null;

  function copyReferralLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Hero greeting ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 px-5 py-6 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-0 h-32 w-64 rounded-full bg-amber-500/5 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-slate-400 text-sm mb-0.5">{greeting} 👋</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">{firstName}</h1>
            <p className="text-slate-500 text-xs mt-1">Welcome back to ATA Sports Live</p>
          </div>

          <div className="sm:text-right">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Cash Balance</p>
            {loadingWallet ? (
              <Skeleton className="h-9 w-28 bg-slate-800 rounded-lg" />
            ) : (
              <div className="text-3xl font-bold font-mono text-teal-400 leading-none">
                ${wallet?.balance?.toFixed(2) ?? '0.00'}
              </div>
            )}
            {!loadingWallet && (wallet?.bonusBalance ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 sm:justify-end">
                <Gift className="h-3 w-3 text-yellow-400" />
                <span className="font-mono text-sm font-bold text-yellow-400">
                  ${(wallet?.bonusBalance ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-yellow-600">bonus</span>
              </div>
            )}
            <Link href="/wallet">
              <span className="inline-flex items-center gap-1 mt-2 text-[11px] text-teal-500 hover:text-teal-300 transition-colors cursor-pointer">
                Manage wallet <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        </div>

        {!isAdmin && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            <Link href="/wallet">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-semibold text-xs px-3.5 py-2 transition-all cursor-pointer">
                <ArrowDownCircle className="h-3.5 w-3.5" /> Deposit
              </div>
            </Link>
            <Link href="/live">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold text-xs px-3.5 py-2 border border-slate-700 transition-all cursor-pointer">
                <Radio className="h-3.5 w-3.5 text-red-400" /> Watch Live
              </div>
            </Link>
            <Link href="/games">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold text-xs px-3.5 py-2 border border-slate-700 transition-all cursor-pointer">
                <Swords className="h-3.5 w-3.5 text-amber-400" /> Place Bet
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* ── Live now banner ───────────────────────────────────── */}
      {liveStream && (
        <Link href="/live">
          <div className="group relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-900 px-4 py-3 cursor-pointer hover:border-red-500/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-red-500/20 border border-red-500/30">
                <Radio className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-flex items-center gap-1 rounded bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 text-[9px] font-bold text-red-400 uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Live now
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{liveStream.sport}</span>
                </div>
                <p className="text-white font-semibold truncate text-sm">{liveStream.title}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-red-400 shrink-0 transition-colors" />
            </div>
          </div>
        </Link>
      )}

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Available */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Available</p>
            <div className="h-6 w-6 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Wallet className="h-3 w-3 text-teal-400" />
            </div>
          </div>
          {loadingWallet ? (
            <Skeleton className="h-6 w-20 bg-slate-800 rounded" />
          ) : (
            <p className="text-lg font-bold font-mono text-white">${wallet?.availableBalance?.toFixed(2) ?? '0.00'}</p>
          )}
          <p className="text-slate-600 text-[10px] mt-1">Cash ready to use</p>
        </div>

        {/* Bonus */}
        <div className={`rounded-2xl border px-4 py-4 transition-colors ${(wallet?.bonusBalance ?? 0) > 0 ? 'border-yellow-500/30 bg-yellow-950/10' : 'border-slate-800 bg-slate-900/80'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Bonus</p>
            <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${(wallet?.bonusBalance ?? 0) > 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-800 border border-slate-700'}`}>
              <Gift className={`h-3 w-3 ${(wallet?.bonusBalance ?? 0) > 0 ? 'text-yellow-400' : 'text-slate-600'}`} />
            </div>
          </div>
          {loadingWallet ? (
            <Skeleton className="h-6 w-20 bg-slate-800 rounded" />
          ) : (
            <p className={`text-lg font-bold font-mono ${(wallet?.bonusBalance ?? 0) > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>${(wallet?.bonusBalance ?? 0).toFixed(2)}</p>
          )}
          <p className="text-slate-600 text-[10px] mt-1">Streams only · 90d expiry</p>
        </div>

        {/* In Bets */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">In Bets</p>
            <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Activity className="h-3 w-3 text-amber-400" />
            </div>
          </div>
          {loadingWallet ? (
            <Skeleton className="h-6 w-20 bg-slate-800 rounded" />
          ) : (
            <p className="text-lg font-bold font-mono text-white">${wallet?.pendingBalance?.toFixed(2) ?? '0.00'}</p>
          )}
          <p className="text-slate-600 text-[10px] mt-1">Locked in markets</p>
        </div>

        {/* Withdrawable */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Withdrawable</p>
            <div className="h-6 w-6 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <TrendingUp className="h-3 w-3 text-teal-400" />
            </div>
          </div>
          {loadingWallet ? (
            <Skeleton className="h-6 w-20 bg-slate-800 rounded" />
          ) : (
            <p className="text-lg font-bold font-mono text-white">${wallet?.withdrawableBalance?.toFixed(2) ?? '0.00'}</p>
          )}
          <p className="text-slate-600 text-[10px] mt-1">Ready to withdraw</p>
        </div>
      </div>

      {/* ── Quick nav tiles ───────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { href: '/live',    label: 'Live',     icon: Radio,  color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
          { href: '/streams', label: 'Streams',  icon: Film,   color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
          { href: '/games',   label: 'Bet',      icon: Target, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
          { href: '/fixtures',label: 'Fixtures', icon: Zap,    color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20' },
        ].map(({ href, label, icon: Icon, color, bg }) => (
          <Link key={href} href={href}>
            <div className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border ${bg} py-3.5 cursor-pointer hover:brightness-110 active:scale-95 transition-all`}>
              <Icon className={`h-4.5 w-4.5 ${color}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Upcoming games teaser ─────────────────────────────── */}
      {nextGames.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-teal-400" /> Next Up
            </h2>
            <Link href="/fixtures">
              <span className="text-xs text-teal-400 hover:text-teal-300 transition-colors cursor-pointer flex items-center gap-1">
                All fixtures <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="space-y-2">
            {nextGames.map((g) => {
              const dt = new Date(`${g.eventDate}T${g.eventTime}`);
              const timeStr = dt.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })
                + ' · ' + dt.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
              return (
                <Link key={g.id} href={`/games/${g.id}`}>
                  <div className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-amber-500/30 hover:bg-slate-900 transition-all cursor-pointer">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Swords className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate group-hover:text-amber-300 transition-colors">
                        {g.playerA} <span className="text-slate-600 font-normal">vs</span> {g.playerB}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-0.5">{timeStr}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-amber-400 transition-colors shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Activity feed: bets + transactions ───────────────── */}
      <div className="space-y-4">

        {/* Recent Bets */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Recent Bets
            </h2>
            <Link href="/bets">
              <span className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {loadingBets ? (
              <div className="px-5 py-4 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg bg-slate-800" />)}
              </div>
            ) : recentBets?.bets?.length ? (
              recentBets.bets.map((bet: any) => {
                const statusStyle = BET_STATUS_STYLES[bet.status] ?? BET_STATUS_STYLES.cancelled;
                const pick = bet.outcome === 'player_a_wins'
                  ? bet.game?.playerA
                  : bet.outcome === 'player_b_wins'
                  ? bet.game?.playerB
                  : bet.outcome?.replace(/_/g, ' ');
                return (
                  <Link key={bet.id} href={`/games/${bet.gameId}`}>
                    <div className="group flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate group-hover:text-amber-300 transition-colors">
                          {bet.game?.playerA} vs {bet.game?.playerB}
                        </p>
                        <p className="text-slate-500 text-[10px] mt-0.5 truncate capitalize">
                          Pick: {pick}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-white font-mono text-sm font-semibold">${bet.stake.toFixed(2)}</p>
                        <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mt-0.5 ${statusStyle}`}>
                          {bet.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="py-8 text-center">
                <Swords className="h-7 w-7 mx-auto text-slate-700 mb-2" />
                <p className="text-slate-500 text-sm">No bets yet</p>
                <Link href="/games">
                  <span className="text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer mt-1 inline-block">
                    Browse games →
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
            <h2 className="font-bold text-white text-sm flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-teal-400" /> Recent Transactions
            </h2>
            <Link href="/wallet">
              <span className="text-xs text-teal-400 hover:text-teal-300 transition-colors cursor-pointer flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {loadingTx ? (
              <div className="px-5 py-4 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg bg-slate-800" />)}
              </div>
            ) : recentTx?.transactions?.length ? (
              recentTx.transactions.map((tx: any) => {
                const isCredit = TX_CREDIT.has(tx.type);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isCredit ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-red-500/10 border border-red-500/20'
                    }`}>
                      {isCredit
                        ? <TrendingUp className="h-3 w-3 text-teal-400" />
                        : <Activity className="h-3 w-3 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-sm font-semibold ${isCredit ? 'text-teal-400' : 'text-red-400'}`}>
                        {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                      </p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        tx.status === 'completed' ? 'text-teal-500'
                          : tx.status === 'failed' || tx.status === 'rejected' ? 'text-red-400'
                          : 'text-amber-400'
                      }`}>{tx.status}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center">
                <Wallet className="h-7 w-7 mx-auto text-slate-700 mb-2" />
                <p className="text-slate-500 text-sm">No transactions yet</p>
                <Link href="/wallet">
                  <span className="text-xs text-teal-400 hover:text-teal-300 transition-colors cursor-pointer mt-1 inline-block">
                    Deposit funds →
                  </span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Referral strip ────────────────────────────────────── */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Users className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Invite a friend — earn together</p>
            <p className="text-slate-500 text-xs">Share your link · earn bonus on every sign-up</p>
          </div>
        </div>
        {referralLink ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 overflow-hidden">
              <p className="font-mono text-xs text-slate-300 truncate">{referralLink}</p>
            </div>
            <button
              onClick={copyReferralLink}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg font-semibold text-xs px-3.5 py-2 transition-all active:scale-95 ${
                copied
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="h-9 rounded-lg bg-slate-800/50 animate-pulse" />
        )}
      </div>

    </div>
  );
}
