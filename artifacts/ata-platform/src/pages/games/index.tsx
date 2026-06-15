import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListGames } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy } from 'lucide-react';

function countryFlag(code?: string | null): string {
  if (!code || code.trim().length < 2) return '';
  const c = code.trim().toUpperCase().slice(0, 2);
  return String.fromCodePoint(c.charCodeAt(0) + 127397) + String.fromCodePoint(c.charCodeAt(1) + 127397);
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

  const allGames: any[] = gamesData?.games || [];
  const topLevel = allGames.filter((g) => !(g as any).parentId);

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
        ) : topLevel.length ? (
          topLevel.map((game: any) => {
            const isCompetition = game.type === 'competition';
            const children = allGames.filter((g: any) => g.parentId === game.id);

            if (isCompetition) {
              return (
                <div key={game.id} className="rounded-xl border border-purple-500/20 bg-card overflow-hidden flex flex-col">
                  <div className="p-5 bg-purple-900/20 border-b border-purple-500/20 flex items-center gap-3">
                    <Trophy className="h-5 w-5 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs mb-1">Competition</Badge>
                      <h3 className="font-bold text-white truncate">{game.playerA}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                        {game.sport} · {game.eventDate}{game.eventEndDate ? ` → ${game.eventEndDate}` : ''}
                        {(game.city || game.country) ? ` · ${[game.city, game.country].filter(Boolean).join(', ')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {children.length === 0 ? (
                      <p className="text-xs text-slate-600 text-center py-4">No matches scheduled yet.</p>
                    ) : children.map((child: any) => (
                      <Link key={child.id} href={`/games/${child.id}`}>
                        <div className="px-5 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="text-center min-w-0 flex-1">
                                <div className="font-semibold text-white text-sm truncate">
                                  {countryFlag((child as any).playerACountry)}{countryFlag((child as any).playerACountry) ? ' ' : ''}{child.playerA}
                                </div>
                              </div>
                              <span className="text-xs text-slate-600 font-bold flex-shrink-0">VS</span>
                              <div className="text-center min-w-0 flex-1">
                                <div className="font-semibold text-white text-sm truncate">
                                  {child.playerB}{countryFlag((child as any).playerBCountry) ? ' ' : ''}{countryFlag((child as any).playerBCountry)}
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <Badge className={`text-xs border ${child.status === 'live' ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : child.status === 'upcoming' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                {child.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex justify-between mt-1 text-xs text-slate-500">
                            <span>{child.eventDate} {child.eventTime}</span>
                            <span>Pool ${(child.totalBetPool || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link key={game.id} href={`/games/${game.id}`}>
                <Card className="group overflow-hidden border-primary/20 bg-card hover:border-amber-500/50 transition-all duration-300 cursor-pointer h-full">
                  <CardContent className="p-0 flex flex-col h-full">
                    <div className="p-5 flex-1 border-b border-slate-800">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">{game.sport}</span>
                        <div className="flex items-center gap-2">
                          {game.status === 'live' && (
                            <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20 animate-pulse">
                              LIVE
                            </span>
                          )}
                          <span className="text-xs font-mono text-slate-500">
                            {new Date(game.eventDate).toLocaleDateString()} {game.eventTime}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-center flex-1">
                          <div className="text-lg text-slate-400 mb-1">
                            {countryFlag((game as any).playerACountry)}
                          </div>
                          <div className="font-bold text-lg text-white leading-tight">{game.playerA}</div>
                          {(game as any).playerACountry && (
                            <div className="text-xs text-slate-500 mt-0.5">{(game as any).playerACountry}</div>
                          )}
                        </div>
                        <div className="px-4 text-xs font-bold text-slate-600">VS</div>
                        <div className="text-center flex-1">
                          <div className="text-lg text-slate-400 mb-1">
                            {countryFlag((game as any).playerBCountry)}
                          </div>
                          <div className="font-bold text-lg text-white leading-tight">{game.playerB}</div>
                          {(game as any).playerBCountry && (
                            <div className="text-xs text-slate-500 mt-0.5">{(game as any).playerBCountry}</div>
                          )}
                        </div>
                      </div>
                      {(game.city || game.country) && (
                        <p className="text-center text-xs text-slate-600 mt-3">
                          📍 {[game.city, game.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
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
          })
        ) : (
          <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No games found matching the criteria.
          </div>
        )}
      </div>
    </div>
  );
}
