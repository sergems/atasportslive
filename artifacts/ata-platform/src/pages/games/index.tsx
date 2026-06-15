import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListGames } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Games() {
  const [status, setStatus] = useState<string>('all');
  const [sport, setSport] = useState<string>('all');
  
  useEffect(() => {
    document.title = 'Games & Markets - ATA Platform';
  }, []);

  const { data: gamesData, isLoading } = useListGames({
    status: status !== 'all' ? status : undefined,
    sport: sport !== 'all' ? sport : undefined,
    limit: 20
  });

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
          Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl bg-slate-800" />)
        ) : gamesData?.games.length ? (
          gamesData.games.map(game => (
            <Link key={game.id} href={`/games/${game.id}`}>
              <Card className="group overflow-hidden border-primary/20 bg-card hover:border-amber-500/50 transition-all duration-300 cursor-pointer h-full">
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="p-5 flex-1 border-b border-slate-800">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{game.sport}</span>
                      <div className="flex items-center gap-2">
                        {game.status === 'live' && (
                          <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20 animate-pulse">
                            LIVE
                          </span>
                        )}
                        <span className="text-xs font-mono text-slate-500">{new Date(game.eventDate).toLocaleDateString()} {game.eventTime}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-center flex-1">
                        <div className="font-bold text-lg text-white">{game.playerA}</div>
                      </div>
                      <div className="px-4 text-xs font-bold text-slate-600">VS</div>
                      <div className="text-center flex-1">
                        <div className="font-bold text-lg text-white">{game.playerB}</div>
                      </div>
                    </div>
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
