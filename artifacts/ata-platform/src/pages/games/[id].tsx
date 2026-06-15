import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useGetGame, usePlaceBet, useListGameBets, getGetWalletQueryKey, getListMyBetsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function FlagImg({ code, className = '' }: { code?: string | null; className?: string }) {
  if (!code || code.trim().length < 2) return null;
  const cc = code.trim().toLowerCase().slice(0, 2);
  return (
    <img
      src={`https://flagcdn.com/40x30/${cc}.png`}
      srcSet={`https://flagcdn.com/80x60/${cc}.png 2x`}
      alt={cc.toUpperCase()}
      className={`inline-block flex-shrink-0 rounded-sm ${className}`}
    />
  );
}

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  live: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function GameDetail() {
  const [, params] = useRoute('/games/:id');
  const [, setLocation] = useLocation();
  const gameId = params?.id ? parseInt(params.id) : 0;
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [nearMatches, setNearMatches] = useState<{ betId: number; stake: number; difference: number }[]>([]);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);

  const { data: game, isLoading } = useGetGame(gameId);
  const { data: betsData } = useListGameBets(gameId);
  const placeBet = usePlaceBet();

  useEffect(() => {
    if (game) document.title = `${game.playerA} vs ${game.playerB} - ATA Platform`;
  }, [game]);

  const handlePlaceBet = async () => {
    if (!isAuthenticated) { setLocation('/login'); return; }
    if (!selectedOutcome || !stakeAmount) { toast.error('Select an outcome and enter a stake'); return; }
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake <= 0) { toast.error('Enter a valid stake amount'); return; }

    try {
      const result = await placeBet.mutateAsync({ data: { gameId, outcome: selectedOutcome, stake } });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
      setMatchStatus(result.matchStatus);
      setNearMatches(result.nearMatches || []);
      if (result.matchStatus === 'exact_match') {
        toast.success('Bet Matched!', { description: 'Your bet was instantly matched.' });
      } else if (result.matchStatus === 'near_match') {
        toast.info('Near Matches Found', { description: 'Check below to accept a near match.' });
      } else {
        toast.success('Bet Placed', { description: 'Your bet is in the queue waiting for a match.' });
      }
      setStakeAmount('');
      setSelectedOutcome(null);
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to place bet');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full bg-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 lg:col-span-2 bg-slate-800" />
          <Skeleton className="h-80 bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!game) return <div className="text-center py-16 text-slate-400">Game not found.</div>;

  const pendingBets = (betsData || []).filter((b: any) => b.status === 'pending');
  const matchedBets = (betsData || []).filter((b: any) => b.status === 'matched');
  const brokerFee = stakeAmount ? parseFloat(stakeAmount) * 2 * 0.10 : 0;
  const potentialPayout = stakeAmount ? parseFloat(stakeAmount) * 2 - brokerFee : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="bg-slate-900 border-primary/20 overflow-hidden">
        <div className="relative bg-gradient-to-r from-teal-900/40 to-amber-900/20 p-8">
          {/* Centred ATA watermark */}
          <img
            src="/ata-logo.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto h-40 w-40 object-contain opacity-[0.06] select-none"
          />
          <div className="relative flex items-center justify-between mb-4">
            <Badge className={`${STATUS_COLORS[game.status]} border text-xs font-semibold uppercase tracking-wider`}>
              {game.status}
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs capitalize">
              {game.sport}
            </Badge>
          </div>
          <div className="flex items-center justify-center gap-8 text-center">
            <div className="flex-1">
              <FlagImg code={(game as any).playerACountry} className="h-8 w-auto mb-2 mx-auto" />
              <div className="text-3xl font-extrabold text-white mb-1">{game.playerA}</div>
              {(game as any).playerACountry && (
                <div className="text-xs text-slate-500 uppercase tracking-wider">{(game as any).playerACountry}</div>
              )}
            </div>
            <div className="flex flex-col items-center">
              <Trophy className="h-8 w-8 text-amber-500 mb-1" />
              <span className="text-slate-400 font-mono text-sm">VS</span>
            </div>
            <div className="flex-1">
              <FlagImg code={(game as any).playerBCountry} className="h-8 w-auto mb-2 mx-auto" />
              <div className="text-3xl font-extrabold text-white mb-1">{game.playerB}</div>
              {(game as any).playerBCountry && (
                <div className="text-xs text-slate-500 uppercase tracking-wider">{(game as any).playerBCountry}</div>
              )}
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-6 text-sm text-slate-400">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{game.eventDate} at {game.eventTime}</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{game.openBetsCount} open bets</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Pool: ${game.totalBetPool.toFixed(2)}</span>
          </div>
          {game.result && (
            <div className="text-center mt-4">
              <Badge className="bg-teal-500/20 text-teal-400 border border-teal-500/30 text-sm font-bold px-4 py-1">
                Result: {game.result.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bet Placement */}
        {['upcoming', 'live'].includes(game.status) && (
          <Card className="lg:col-span-2 bg-slate-900 border-primary/20">
            <CardHeader>
              <CardTitle className="text-white">Place Your Bet</CardTitle>
              <p className="text-slate-400 text-sm">10% brokerage fee on winnings. Stakes are locked until matched.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: game.playerA, value: 'player_a_wins', color: 'teal' },
                  { label: game.playerB, value: 'player_b_wins', color: 'amber' },
                ].map(({ label, value, color }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedOutcome(value)}
                    className={`p-6 rounded-xl border-2 text-center transition-all ${
                      selectedOutcome === value
                        ? color === 'teal' ? 'border-teal-500 bg-teal-500/10' : 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-lg font-bold text-white">{label}</div>
                    <div className="text-xs text-slate-400 mt-1">Wins</div>
                    {selectedOutcome === value && (
                      <div className={`mt-2 text-xs font-semibold ${color === 'teal' ? 'text-teal-400' : 'text-amber-400'}`}>
                        Selected ✓
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Stake Amount (USD)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter stake..."
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              {stakeAmount && parseFloat(stakeAmount) > 0 && (
                <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Your Stake</span>
                    <span className="text-white font-mono">${parseFloat(stakeAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Potential Pool</span>
                    <span className="text-white font-mono">${(parseFloat(stakeAmount) * 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Brokerage (10%)</span>
                    <span className="text-red-400 font-mono">-${brokerFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 flex justify-between font-bold">
                    <span className="text-slate-200">Potential Payout</span>
                    <span className="text-teal-400 font-mono">${potentialPayout.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePlaceBet}
                disabled={!selectedOutcome || !stakeAmount || placeBet.isPending}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-12"
              >
                {placeBet.isPending ? 'Placing Bet...' : 'Place Bet'}
              </Button>

              {nearMatches.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold mb-3">
                    <AlertCircle className="h-4 w-4" />
                    Near Matches Available
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    These open bets are within 20% of your stake. You can accept one to get matched now.
                  </p>
                  {nearMatches.map((nm) => (
                    <div key={nm.betId} className="flex items-center justify-between bg-slate-800 rounded-lg p-3 mb-2">
                      <span className="text-sm text-slate-300">Stake: ${nm.stake.toFixed(2)} (diff: ${nm.difference.toFixed(2)})</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="space-y-4">
          <Card className="bg-slate-900 border-primary/20">
            <CardHeader><CardTitle className="text-white text-base">Bet Activity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Open Bets</span>
                <span className="text-white font-mono">{game.openBetsCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Matched Pairs</span>
                <span className="text-teal-400 font-mono">{game.matchedBetsCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Pool</span>
                <span className="text-amber-400 font-mono">${game.totalBetPool.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-primary/20">
            <CardHeader><CardTitle className="text-white text-base">Recent Bets</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {pendingBets.length === 0 && matchedBets.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No bets yet. Be the first!</p>
              ) : (
                [...pendingBets.slice(0, 3), ...matchedBets.slice(0, 3)].map((bet: any) => (
                  <div key={bet.id} className="flex justify-between text-xs">
                    <span className="text-slate-400">${bet.stake.toFixed(2)} on {bet.outcome.includes('player_a') ? game.playerA : game.playerB}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{bet.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
