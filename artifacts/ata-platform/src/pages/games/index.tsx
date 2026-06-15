import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListGames } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Trophy } from 'lucide-react';

function countryFlag(code?: string | null): string {
  if (!code || code.trim().length < 2) return '';
  const c = code.trim().toUpperCase().slice(0, 2);
  return String.fromCodePoint(c.charCodeAt(0) + 127397) + String.fromCodePoint(c.charCodeAt(1) + 127397);
}

function statusBadge(status: string) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20 animate-pulse">
        LIVE
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
        UPCOMING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">
      {status}
    </span>
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
  eventDate: string;
  eventTime?: string | null;
  totalBetPool?: number | null;
  openBetsCount?: number | null;
  matchedBetsCount?: number | null;
  city?: string | null;
  country?: string | null;
  type?: string | null;
  parentId?: number | null;
}

interface GameCardProps {
  game: Game;
  competitionName?: string | null;
}

function GameCard({ game, competitionName }: GameCardProps) {
  return (
    <Link href={`/games/${game.id}`}>
      <Card className="group overflow-hidden border-primary/20 bg-card hover:border-amber-500/50 transition-all duration-300 cursor-pointer h-full">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="p-5 flex-1 border-b border-slate-800 flex flex-col">
            {/* Competition label (top) */}
            {competitionName && (
              <div className="flex items-center gap-1 mb-3">
                <Trophy className="h-3 w-3 text-purple-400 flex-shrink-0" />
                <span className="text-[10px] font-medium text-purple-300 uppercase tracking-wider truncate">
                  {competitionName}
                </span>
              </div>
            )}

            {/* Sport + status + date */}
            <div className="flex justify-between items-center mb-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">
                {game.sport}
              </span>
              <div className="flex items-center gap-2">
                {statusBadge(game.status)}
                <span className="text-xs font-mono text-slate-500">
                  {new Date(game.eventDate).toLocaleDateString()} {game.eventTime}
                </span>
              </div>
            </div>

            {/* Players */}
            <div className="flex justify-between items-center flex-1">
              <div className="text-center flex-1">
                <div className="text-lg text-slate-400 mb-1">
                  {countryFlag(game.playerACountry)}
                </div>
                <div className="font-bold text-lg text-white leading-tight">{game.playerA}</div>
                {game.playerACountry && (
                  <div className="text-xs text-slate-500 mt-0.5">{game.playerACountry}</div>
                )}
              </div>
              <div className="px-4 text-xs font-bold text-slate-600">VS</div>
              <div className="text-center flex-1">
                <div className="text-lg text-slate-400 mb-1">
                  {countryFlag(game.playerBCountry)}
                </div>
                <div className="font-bold text-lg text-white leading-tight">{game.playerB}</div>
                {game.playerBCountry && (
                  <div className="text-xs text-slate-500 mt-0.5">{game.playerBCountry}</div>
                )}
              </div>
            </div>

            {/* City / country (bottom of content area) */}
            {(game.city || game.country) && (
              <div className="flex items-center justify-center gap-1 mt-4 text-xs text-slate-500">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span>{[game.city, game.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Bet stats footer */}
          <div className="p-4 bg-slate-900/50 flex justify-between items-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Pool Size</div>
              <div className="font-mono font-bold text-amber-400">${(game.totalBetPool || 0).toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Open Bets</div>
              <div className="font-mono font-bold text-white">{game.openBetsCount || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Games() {
  const [status, setStatus] = useState<string>('all');
  const [sport, setSport] = useState<string>('all');

  useEffect(() => {
    document.title = 'Games & Markets - ATA Platform';
  }, []);

  const { data: gamesData, isLoading } = useListGames({
    status: status !== 'all' ? status : undefined,
    sport: sport !== 'all' ? sport : undefined,
    limit: 50,
  });

  const allGames: Game[] = (gamesData?.games || []) as Game[];

  // Build a map of competition id → competition name
  const competitionMap = new Map<number, string>();
  allGames.forEach((g) => {
    if (g.type === 'competition') {
      // Competition name is stored in playerA field
      competitionMap.set(g.id, g.playerA);
    }
  });

  // Flatten: show every non-competition game individually.
  // Children of competitions carry the competition name label.
  // Competition nodes themselves are skipped (they're just containers).
  const flatGames = allGames.filter((g) => g.type !== 'competition');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Betting Exchange</h1>
          <p className="text-slate-400 mt-1">P2P markets for African sports</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-800 text-white">
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
            <SelectTrigger className="w-[140px] bg-slate-900 border-slate-800 text-white">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl bg-slate-800" />
          ))
        ) : flatGames.length ? (
          flatGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              competitionName={game.parentId ? competitionMap.get(game.parentId) : null}
            />
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No games found matching the criteria.
          </div>
        )}
      </div>
    </div>
  );
}
