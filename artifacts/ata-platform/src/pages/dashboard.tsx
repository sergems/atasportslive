import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useGetWallet, useListMyBets, useListTransactions, useListNotifications } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import {
  Wallet, Activity, TrendingUp, History, Radio,
  Film, ChevronRight, Trophy, Clock,
  Zap, Target, Gift, Copy, Check, Users, Bell
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifData } = useListNotifications({ unreadOnly: true }, { query: { refetchInterval: 30000 } as any });
  const unreadCount = notifData?.unreadCount ?? 0;

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

  const stats = [
    { label: 'Available', value: wallet?.availableBalance, icon: Wallet, tone: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
    { label: 'Bonus wallet', value: wallet?.bonusBalance, icon: Gift, tone: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
    { label: 'In play', value: wallet?.pendingBalance, icon: Activity, tone: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'Withdrawable', value: wallet?.withdrawableBalance, icon: TrendingUp, tone: 'text-white', bg: 'bg-slate-700/40 border-slate-600/40' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/50 px-6 py-7 shadow-2xl shadow-black/30 sm:px-9 sm:py-9">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">{greeting}</p>
            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-2xl font-extrabold leading-[1.05] text-white">{firstName}</h1>
              <Link href="/notifications">
                <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10" aria-label="Notifications">
                  <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'text-amber-400' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </Link>
            </div>
            <p className="mt-3 max-w-md text-base leading-relaxed text-slate-400">
              Your sport, your wallet, your moment — everything in one place.
            </p>
          </div>

          <div className="w-full min-w-[240px] rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:w-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Available balance</p>
            {loadingWallet ? (
              <Skeleton className="mt-2 h-10 w-36 rounded-lg bg-slate-800" />
            ) : (
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-teal-400">
                ${wallet?.availableBalance?.toFixed(2) ?? '0.00'}
              </p>
            )}
            {!loadingWallet && (wallet?.bonusBalance ?? 0) > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-yellow-400">
                <Gift className="h-3.5 w-3.5" />
                <span className="font-semibold tabular-nums">${(wallet?.bonusBalance ?? 0).toFixed(2)}</span>
                <span className="text-xs text-yellow-600">bonus</span>
              </div>
            )}
            <Link href="/wallet">
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-400 hover:text-teal-300">
                Manage wallet <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
        </div>

        {!isAdmin && (
          <div className="relative mt-7 flex flex-wrap gap-3">
            {[
              { href: '/wallet',  label: 'Deposit',    icon: Wallet, style: 'bg-teal-500 text-slate-950 hover:bg-teal-400' },
              { href: '/live',    label: 'Watch Live', icon: Radio,  style: 'bg-white/5 text-white border border-white/10 hover:bg-white/10' },
              { href: '/games',   label: 'Predict',    icon: Target, style: 'bg-white/5 text-white border border-white/10 hover:bg-white/10' },
            ].map(({ href, label, icon: Icon, style }) => (
              <Link key={href} href={href}>
                <span className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-95 cursor-pointer ${style}`}>
                  <Icon className="h-4 w-4" /> {label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Live now ──────────────────────────────────────────── */}
      {liveStream && (
        <Link href="/live">
          <div className="group relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-900 px-5 py-4 transition hover:border-red-500/60 cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15">
                <Radio className="h-5 w-5 text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Live now
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{liveStream.sport}</span>
                </div>
                <p className="mt-1 truncate text-base font-semibold text-white">{liveStream.title}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:text-red-400" />
            </div>
          </div>
        </Link>
      )}

      {/* ── Balance stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone, bg }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/10">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${bg}`}>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            {loadingWallet ? (
              <Skeleton className="mt-1 h-8 w-24 rounded bg-slate-800" />
            ) : (
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white">
                ${value?.toFixed(2) ?? '0.00'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Quick links ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: '/live',     label: 'Live',      icon: Radio,  tone: 'text-red-400' },
          { href: '/streams',  label: 'Streams',   icon: Film,   tone: 'text-violet-400' },
          { href: '/games',    label: 'Predict',   icon: Target, tone: 'text-amber-400' },
          { href: '/fixtures', label: 'Fixtures',  icon: Zap,    tone: 'text-teal-400' },
        ].map(({ href, label, icon: Icon, tone }) => (
          <Link key={href} href={href}>
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 py-5 transition hover:border-slate-600 hover:bg-slate-900 cursor-pointer">
              <Icon className={`h-5 w-5 ${tone}`} />
              <span className={`text-sm font-semibold ${tone}`}>{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Next up ───────────────────────────────────────────── */}
      {nextGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
              <Clock className="h-4 w-4 text-teal-400" /> Next up
            </h2>
            <Link href="/fixtures">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-teal-400 hover:text-teal-300">
                All fixtures <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {nextGames.map((g) => {
              const dt = new Date(`${g.eventDate}T${g.eventTime}`);
              const timeStr = dt.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })
                + ' · ' + dt.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
              return (
                <Link key={g.id} href={`/games/${g.id}`}>
                  <div className="group flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-amber-500/40 cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                      <Trophy className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white transition group-hover:text-amber-300">
                        {g.playerA} <span className="font-normal text-slate-600">vs</span> {g.playerB}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{timeStr}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-700 transition group-hover:text-amber-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Activity ──────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Trophy className="h-4 w-4 text-amber-400" /> Recent predictions
            </h2>
            <Link href="/bets">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-400 hover:text-amber-300">View all <ChevronRight className="h-3.5 w-3.5" /></span>
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {loadingBets ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded bg-slate-800" />)}</div>
            ) : recentBets?.bets?.length ? (
              recentBets.bets.map((bet: any) => {
                const statusStyle = BET_STATUS_STYLES[bet.status] ?? BET_STATUS_STYLES.cancelled;
                const pick = bet.outcome === 'player_a_wins' ? bet.game?.playerA
                  : bet.outcome === 'player_b_wins' ? bet.game?.playerB
                  : bet.outcome?.replace(/_/g, ' ');
                return (
                  <Link key={bet.id} href={`/games/${bet.gameId}`}>
                    <div className="group flex items-center gap-3 px-5 py-4 transition hover:bg-slate-800/40 cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white transition group-hover:text-amber-300">
                          {bet.game?.playerA} vs {bet.game?.playerB}
                        </p>
                        <p className="mt-0.5 truncate text-xs capitalize text-slate-500">Pick: {pick}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-white">${bet.stake.toFixed(2)}</p>
                        <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyle}`}>{bet.status}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="py-10 text-center">
                <Trophy className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-2 text-sm text-slate-500">No predictions yet</p>
                <Link href="/games"><span className="mt-1 inline-block text-sm font-semibold text-amber-400">Browse games →</span></Link>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <History className="h-4 w-4 text-teal-400" /> Recent transactions
            </h2>
            <Link href="/wallet">
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-teal-400 hover:text-teal-300">View all <ChevronRight className="h-3.5 w-3.5" /></span>
            </Link>
          </div>
          <div className="divide-y divide-slate-800/60">
            {loadingTx ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded bg-slate-800" />)}</div>
            ) : recentTx?.transactions?.length ? (
              recentTx.transactions.map((tx: any) => {
                const isCredit = TX_CREDIT.has(tx.type);
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isCredit ? 'border-teal-500/20 bg-teal-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
                      {isCredit ? <TrendingUp className="h-4 w-4 text-teal-400" /> : <Activity className="h-4 w-4 text-red-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold capitalize text-white">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-teal-400' : 'text-red-400'}`}>
                        {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                      </p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${tx.status === 'completed' ? 'text-teal-500' : tx.status === 'failed' || tx.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>{tx.status}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center">
                <Wallet className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-2 text-sm text-slate-500">No transactions yet</p>
                <Link href="/wallet"><span className="mt-1 inline-block text-sm font-semibold text-teal-400">Deposit funds →</span></Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Referral ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
            <Users className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white">Invite a friend — earn together</p>
            <p className="text-sm text-slate-400">Share your link and earn a bonus on every sign-up</p>
          </div>
        </div>
        {referralLink ? (
          <div className="mt-4 flex gap-2">
            <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
              <p className="truncate font-mono text-sm text-slate-300">{referralLink}</p>
            </div>
            <button
              onClick={copyReferralLink}
              className={`shrink-0 rounded-xl px-5 py-3 text-sm font-bold transition active:scale-95 ${copied ? 'bg-teal-500 text-slate-950' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'}`}
            >
              <span className="inline-flex items-center gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied!' : 'Copy link'}</span>
            </button>
          </div>
        ) : <div className="mt-4 h-10 animate-pulse rounded-xl bg-slate-800/50" />}
      </section>
    </div>
  );
}
