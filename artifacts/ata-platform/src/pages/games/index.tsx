import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListGames } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Trophy } from 'lucide-react';

function countryFlag(code?: string | null): string {
  if (!code || code.trim().length < 2) return '';
  const c = code.trim().toUpperCase().slice(0, 2);
  return String.fromCodePoint(c.charCodeAt(0) + 127397) + String.fromCodePoint(c.charCodeAt(1) + 127397);
}

interface Game {
  id: number;
  sport: string;
  playerA: string;
  playerB: string;
  playerACountry?: string | null;
  playerBCountry?: string | null;
  status: string;
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
  return <span className="rounded bg-slate-700/40 border border-slate-700/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 capitalize">{status}</span>;
}

function GameCard({ game, competitionName }: { game: Game; competitionName?: string | null }) {
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
      <div className="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 hover:border-amber-500/40 hover:bg-slate-900 transition-all duration-200 cursor-pointer">
        {/* Faded ATA watermark */}
        <img
          src="/ata-logo.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 h-14 w-14 object-contain opacity-[0.045] select-none"
        />

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
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {countryFlag(game.playerACountry) && (
                <div className="text-base leading-none mb-0.5">{countryFlag(game.playerACountry)}</div>
              )}
              <div className="text-sm font-bold text-white leading-snug break-words">
                {game.playerA}
              </div>
              {game.playerACountry && (
                <div className="text-[10px] text-slate-500 mt-0.5">{game.playerACountry}</div>
              )}
            </div>
            <span className="text-[10px] font-black text-slate-600 flex-shrink-0 px-1">VS</span>
            <div className="flex-1 min-w-0 text-right">
              {countryFlag(game.playerBCountry) && (
                <div className="text-base leading-none mb-0.5">{countryFlag(game.playerBCountry)}</div>
              )}
              <div className="text-sm font-bold text-white leading-snug break-words">
                {game.playerB}
              </div>
              {game.playerBCountry && (
                <div className="text-[10px] text-slate-500 mt-0.5">{game.playerBCountry}</div>
              )}
            </div>
          </div>

          {/* Footer: pool + bets + location */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
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

export default function Games() {
  const [status, setStatus] = useState<string>('all');
  const [sport, setSport] = useState<string>('all');

  useEffect(() => { document.title = 'Games & Markets - ATA Platform'; }, []);

  const { data: gamesData, isLoading } = useListGames({
    status: status !== 'all' ? status : undefined,
    sport: sport !== 'all' ? sport : undefined,
    limit: 50,
  });

  const allGames: Game[] = (gamesData?.games || []) as Game[];

  const competitionMap = new Map<number, string>();
  allGames.forEach((g) => {
    if (g.type === 'competition') competitionMap.set(g.id, g.playerA);
  });

  const flatGames = allGames.filter((g) => g.type !== 'competition');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Betting Exchange</h1>
          <p className="text-slate-400 text-sm mt-0.5">P2P markets for African sports</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-[120px] bg-slate-900 border-slate-800 text-white text-sm h-8">
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
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[120px] bg-slate-900 border-slate-800 text-white text-sm h-8">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading
          ? Array(8).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg bg-slate-800" />
            ))
          : flatGames.length
          ? flatGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                competitionName={game.parentId ? competitionMap.get(game.parentId) : null}
              />
            ))
          : (
            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-sm">
              No games found.
            </div>
          )}
      </div>
    </div>
  );
}
