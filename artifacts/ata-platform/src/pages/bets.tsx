import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListMyBets } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Clock, TrendingUp } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  matched: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  won: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  refunded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const FILTERS = ['all', 'pending', 'matched', 'won', 'lost', 'cancelled', 'refunded'];

export default function Bets() {
  useEffect(() => { document.title = 'My Bets - ATA Platform'; }, []);
  const [filter, setFilter] = useState('all');

  const { data: betsData, isLoading } = useListMyBets({
    status: filter !== 'all' ? filter : undefined,
    limit: 50,
  });

  const bets = betsData?.bets || [];

  const stats = {
    total: betsData?.total || 0,
    won: bets.filter((b: any) => b.status === 'won').length,
    pending: bets.filter((b: any) => b.status === 'pending').length,
    totalStaked: bets.reduce((sum: number, b: any) => sum + b.stake, 0),
    totalWon: bets.filter((b: any) => b.status === 'won').reduce((sum: number, b: any) => sum + b.potentialReturn, 0),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">My Bets</h1>
        <p className="text-slate-400 mt-1">Track all your betting activity across games.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Bets', value: stats.total, color: 'text-white' },
          { label: 'Won', value: stats.won, color: 'text-green-400' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          { label: 'Total Staked', value: `$${stats.totalStaked.toFixed(2)}`, color: 'text-teal-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-slate-900 border-primary/20">
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bets List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 bg-slate-800 rounded-xl" />)}</div>
      ) : bets.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No bets found.</p>
          <Link href="/games">
            <Button className="mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950">Browse Games</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bets.map((bet: any) => (
            <Card key={bet.id} className="bg-slate-900 border-primary/20 hover:border-primary/40 transition-colors">
              <CardContent className="py-4 px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge className={`${STATUS_COLORS[bet.status]} border text-xs font-semibold`}>{bet.status}</Badge>
                      <span className="text-xs text-slate-500 font-mono">{bet.ticketId}</span>
                    </div>
                    {bet.game ? (
                      <Link href={`/games/${bet.gameId}`}>
                        <p className="text-white font-semibold hover:text-teal-400 transition-colors">
                          {bet.game.playerA} <span className="text-slate-500">vs</span> {bet.game.playerB}
                        </p>
                      </Link>
                    ) : (
                      <p className="text-white font-semibold">Game #{bet.gameId}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">
                      Backing: {bet.outcome === 'player_a_wins' ? bet.game?.playerA : bet.outcome === 'player_b_wins' ? bet.game?.playerB : bet.outcome.replace(/_/g, ' ')} · {bet.game?.sport}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-white font-mono font-bold">${bet.stake.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">Stake</div>
                    {bet.potentialReturn > 0 && (
                      <div className="text-teal-400 font-mono text-sm mt-1">
                        ${bet.potentialReturn.toFixed(2)} <span className="text-slate-500 text-xs">payout</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {new Date(bet.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {bet.settledAt && <span> · Settled {new Date(bet.settledAt).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
