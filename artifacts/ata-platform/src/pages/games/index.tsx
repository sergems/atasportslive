import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListGames } from '@workspace/api-client-react';
import { useSEO, makeBreadcrumb, SITE_URL } from '@/lib/seo';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Trophy, TrendingUp, CheckCircle2, Lock, Hourglass } from 'lucide-react';

function FlagImg({ code, className = '' }: { code?: string | null; className?: string }) {
  if (!code || code.trim().length < 2) return null;
  const cc = code.trim().toLowerCase().slice(0, 2);
  return (
    <img
      src={`https://flagcdn.com/20x15/${cc}.png`}
      srcSet={`https://flagcdn.com/40x30/${cc}.png 2x`}
      alt={cc.toUpperCase()}
      className={`inline-block flex-shrink-0 rounded-[1px] ${className}`}
      style={{ height: 12, width: 'auto' }}
    />
  );
}

interface Game {
  id: number;
  sport: string;
  playerA: string;
  playerB: string;
  playerACountry?: string | null;
  playerBCountry?: string | null;
  status: string;
  result?: string | null;
  eventDate: string;
  eventTime?: string | null;
  totalBetPool?: number | null;
  openBetsCount?: number | null;
  city?: string | null;
  country?: string | null;
  type?: string | null;
  parentId?: number | null;
}

function StatusPill({ status }: { status: string }) {
  if (status === 'live')
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
      </span>
    );
  if (status === 'upcoming')
    return <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">UPCOMING</span>;
  if (status === 'completed')
    return <span className="rounded bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-400">COMPLETED</span>;
  return <span className="rounded bg-slate-700/40 border border-slate-700/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 capitalize">{status}</span>;
}

function gameHasStarted(game: Game): boolean {
  const timeStr = game.eventTime || '00:00';
  return new Date() >= new Date(`${game.eventDate}T${timeStr}`);
}

function GameCard({ game, competitionName, showResult, locked }: { game: Game; competitionName?: string | null; showResult?: boolean; locked?: boolean }) {
  const sportColor: Record<string, string> = {
    pool: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    boxing: 'text-red-400 bg-red-500/10 border-red-500/20',
    football: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    athletics: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    basketball: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };
  const sc = sportColor[game.sport] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20';

  return (
    <Link href={`/games/${game.id}`}>
      <div className={`group relative overflow-hidden rounded-lg border bg-slate-900/80 transition-all duration-200 cursor-pointer ${locked ? 'border-slate-700/60 opacity-80 hover:border-slate-600' : 'border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'}`}>
        {/* Faded ATA watermark */}
        <img
          src="/ata-logo.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 h-14 w-14 object-contain opacity-[0.045] select-none"
        />
        {/* Lock badge for started events */}
        {locked && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded bg-slate-800/90 border border-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
            <Lock className="h-2.5 w-2.5" /> BETTING CLOSED
          </div>
        )}

        <div className="relative p-3 flex flex-col gap-2">
          {/* Competition label */}
          {competitionName && (
            <div className="flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5 text-purple-400 flex-shrink-0" />
              <span className="text-[9px] font-semibold text-purple-300 uppercase tracking-wider truncate">
                {competitionName}
              </span>
            </div>
          )}

          {/* Sport + status + date */}
          <div className="flex items-center justify-between gap-1">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc}`}>
              {game.sport}
            </span>
            <div className="flex items-center gap-1.5">
              <StatusPill status={game.status} />
              <span className="text-[10px] font-mono text-slate-500 hidden sm:block">
                {new Date(game.eventDate).toLocaleDateString()}
                {game.eventTime ? ` ${game.eventTime}` : ''}
              </span>
            </div>
          </div>

          {/* Players row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
              <div className="text-sm font-bold text-white leading-tight truncate text-right">{game.playerA}</div>
              <FlagImg code={game.playerACountry} />
            </div>
            <span className="text-[10px] font-black text-slate-600 flex-shrink-0">VS</span>
            <div className="flex-1 flex items-center justify-start gap-1.5 min-w-0">
              <FlagImg code={game.playerBCountry} />
              <div className="text-sm font-bold text-white leading-tight truncate text-left">{game.playerB}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
            {showResult && game.result ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-teal-400">
                <CheckCircle2 className="h-3 w-3" />
                {game.result.replace(/_/g, ' ').replace('player a', game.playerA).replace('player b', game.playerB).toUpperCase()}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">Pool</div>
                  <div className="text-xs font-mono font-bold text-amber-400">${(game.totalBetPool || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-600">Open</div>
                  <div className="text-xs font-mono font-bold text-white">{game.openBetsCount || 0}</div>
                </div>
              </div>
            )}
            {(game.city || game.country) && (
              <div className="flex items-center gap-0.5 text-[10px] text-slate-500 truncate max-w-[45%]">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{[game.city, game.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

type Tab = 'betting' | 'awaiting' | 'results';

export default function Games() {
  const [tab, setTab] = useState<Tab>('betting');
  const [sport, setSport] = useState<string>('all');

  useSEO({
    title: 'Betting Markets & Live Games',
    path: '/games',
    description: 'Place and match P2P bets on live Pool and Boxing matches across Africa. Real odds, instant matching, 10% brokerage on winnings only.',
    jsonLd: makeBreadcrumb([
      { name: 'Home', url: SITE_URL },
      { name: 'Betting Markets', url: `${SITE_URL}/games` },
    ]),
  });

  const { data: gamesData, isLoading } = useListGames({
    sport: sport !== 'all' ? sport : undefined,
    limit: 100,
  });

  const allGames: Game[] = (gamesData?.games || []) as Game[];

  const containerTypes = new Set(['competition', 'tour']);

  const containerMap = new Map<number, string>();
  allGames.forEach((g) => {
    if (containerTypes.has(g.type ?? '')) containerMap.set(g.id, g.playerA);
  });

  const singleMatches = allGames.filter((g) => !containerTypes.has(g.type ?? ''));
  const bettingGames = singleMatches.filter((g) => g.status === 'upcoming' && !gameHasStarted(g));
  const awaitingGames = singleMatches.filter(
    (g) => (g.status === 'upcoming' || g.status === 'live') && gameHasStarted(g),
  );
  const resultGames = singleMatches.filter((g) => g.status === 'completed');

  const displayed = tab === 'betting' ? bettingGames : tab === 'awaiting' ? awaitingGames : resultGames;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Games</h1>
          <p className="text-slate-400 text-sm mt-0.5">P2P betting exchange · African sports</p>
        </div>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger className="w-[130px] bg-slate-900 border-slate-800 text-white text-sm h-8">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white">
            <SelectItem value="all">All Sports</SelectItem>
            <SelectItem value="pool">Pool</SelectItem>
            <SelectItem value="boxing">Boxing</SelectItem>
            <SelectItem value="football">Football</SelectItem>
            <SelectItem value="athletics">Athletics</SelectItem>
            <SelectItem value="basketball">Basketball</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setTab('betting')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'betting'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Betting Exchange
          {bettingGames.length > 0 && (
            <span className="rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
              {bettingGames.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('awaiting')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'awaiting'
              ? 'border-orange-400 text-orange-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hourglass className="h-4 w-4" />
          Awaiting Settlement
          {awaitingGames.length > 0 && (
            <span className="rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
              {awaitingGames.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('results')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'results'
              ? 'border-teal-400 text-teal-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Results
          {resultGames.length > 0 && (
            <span className="rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
              {resultGames.length}
            </span>
          )}
        </button>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg bg-slate-800" />
            ))
          : displayed.length
          ? displayed.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                competitionName={game.parentId ? containerMap.get(game.parentId) : null}
                showResult={tab === 'results'}
                locked={tab === 'awaiting'}
              />
            ))
          : (
            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-sm">
              {tab === 'betting'
                ? 'No upcoming games available for betting.'
                : tab === 'awaiting'
                ? 'No events are currently awaiting settlement.'
                : 'No results yet.'}
            </div>
          )}
      </div>
    </div>
  );
}
