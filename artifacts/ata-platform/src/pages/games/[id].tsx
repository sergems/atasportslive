import React, { useEffect, useState } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useGetGame, usePlaceBet, useAcceptNearMatch, useListGameBets, getGetWalletQueryKey, getListMyBetsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, TrendingUp, Clock, AlertCircle, ChevronLeft, CalendarClock, MapPin, Swords, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const CONTAINER_TYPES = new Set(['competition', 'tour']);
const MIN_STAKE = 1;

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
  const [myPlacedBetId, setMyPlacedBetId] = useState<number | null>(null);
  const [myPlacedStake, setMyPlacedStake] = useState<number>(0);
  const [dismissedMatches, setDismissedMatches] = useState<Set<number>>(new Set());

  const { data: game, isLoading } = useGetGame(gameId);
  const { data: betsData } = useListGameBets(gameId);
  const placeBet = usePlaceBet();
  const acceptNearMatch = useAcceptNearMatch();

  const hasStarted = game
    ? new Date() >= new Date(`${game.eventDate}T${(game as any).eventTime || '00:00'}`)
    : false;

  const isContainer = CONTAINER_TYPES.has((game as any)?.type ?? '');

  const { data: childMatchesData } = useQuery({
    queryKey: ['games', 'children', gameId],
    queryFn: () => fetch(`/api/games?limit=200`).then((r) => r.json()),
    enabled: isContainer,
  });
  const childMatches: any[] = isContainer
    ? ((childMatchesData?.games || []) as any[]).filter((g: any) => g.parentId === gameId)
    : [];

  useEffect(() => {
    if (game) {
      document.title = isContainer
        ? `${game.playerA} — ATA Platform`
        : `${game.playerA} vs ${game.playerB} - ATA Platform`;
    }
  }, [game, isContainer]);

  const handlePlaceBet = async () => {
    if (!isAuthenticated) { setLocation('/login'); return; }
    if (!selectedOutcome || !stakeAmount) { toast.error('Select an outcome and enter a stake'); return; }
    const stake = parseFloat(stakeAmount);
    if (isNaN(stake) || stake < MIN_STAKE) { toast.error(`Minimum stake is ${MIN_STAKE}`); return; }

    try {
      const result = await placeBet.mutateAsync({ data: { gameId, outcome: selectedOutcome as any, stake } });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
      setMatchStatus(result.matchStatus);
      setNearMatches(result.nearMatches || []);
      setMyPlacedBetId((result as any).bet?.id ?? null);
      setMyPlacedStake(stake);
      setDismissedMatches(new Set());
      if (result.matchStatus === 'exact_match') {
        toast.success('Prediction Matched!', { description: 'Your prediction was instantly matched.' });
      } else if (result.matchStatus === 'near_match') {
        toast.info('Near Matches Found', { description: 'Check below to accept or reject each near match.' });
      } else {
        toast.success('Prediction Placed', { description: 'Your prediction is in the queue waiting for a match.' });
      }
      setStakeAmount('');
      setSelectedOutcome(null);
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to place prediction');
    }
  };

  const handleAcceptNearMatch = async (opponentBetId: number, opponentStake: number, myStake: number) => {
    if (!myPlacedBetId) return;
    try {
      await acceptNearMatch.mutateAsync({ id: myPlacedBetId, data: { opponentBetId } });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMyBetsQueryKey() });
      const diff = opponentStake - myStake;
      if (diff > 0) {
        toast.success('Prediction Matched!', { description: `${diff.toFixed(2)} was charged from your wallet. Matched at ${opponentStake.toFixed(2)}.` });
      } else if (diff < 0) {
        toast.success('Prediction Matched!', { description: `${Math.abs(diff).toFixed(2)} refunded to your wallet. Matched at ${opponentStake.toFixed(2)}.` });
      } else {
        toast.success('Prediction Matched!', { description: `Matched at ${opponentStake.toFixed(2)}.` });
      }
      setNearMatches([]);
      setMyPlacedBetId(null);
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to accept match');
    }
  };

  const handleRejectNearMatch = (betId: number) => {
    setDismissedMatches((prev) => new Set([...prev, betId]));
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
  const containerLabel = (game as any).type === 'tour' ? 'Tour' : 'Competition';

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <Link href="/games">
        <button className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Games
        </button>
      </Link>

      {/* Header */}
      <Card className="bg-slate-900 border-primary/20 overflow-hidden">
        <div className="relative bg-gradient-to-r from-teal-900/40 to-amber-900/20 p-8">
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

          {isContainer ? (
            /* Competition / Tour header — no VS layout */
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">
                <Trophy className="h-4 w-4" /> {containerLabel}
              </div>
              <div className="text-4xl font-extrabold text-white mb-2">{game.playerA}</div>
              <div className="flex justify-center flex-wrap gap-4 mt-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{game.eventDate}</span>
                {(game as any).eventEndDate && (
                  <span className="flex items-center gap-1.5">– {(game as any).eventEndDate}</span>
                )}
                {((game as any).city || (game as any).country) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />{[(game as any).city, (game as any).country].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Single match header — VS layout */
            <>
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
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{game.openBetsCount} predictions</span>
                <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Pool: ${(game.totalBetPool ?? 0).toFixed(2)}</span>
              </div>
              {game.result && (
                <div className="text-center mt-4">
                  <Badge className="bg-teal-500/20 text-teal-400 border border-teal-500/30 text-sm font-bold px-4 py-1">
                    {game.result === 'player_a_wins'
                      ? `${game.playerA} Won`
                      : game.result === 'player_b_wins'
                      ? `${game.playerB} Won`
                      : game.result.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Predictions closed banner — shown for non-container matches that have started but aren't settled */}
      {!isContainer && hasStarted && game.status !== 'completed' && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-5 py-4">
          <Lock className="h-5 w-5 text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-300">Predictions are closed for this event</p>
            <p className="text-xs text-slate-400 mt-0.5">
              This match has started. All existing matched predictions will be settled once the result is confirmed by an admin.
            </p>
          </div>
        </div>
      )}

      {/* Competition / Tour: show child matches to bet on */}
      {isContainer ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Matches in this {containerLabel}</h2>
            <span className="text-xs text-slate-500 ml-1">— select a match below to make your prediction</span>
          </div>

          {!childMatchesData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl bg-slate-800" />)}
            </div>
          ) : childMatches.length === 0 ? (
            <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-sm">
              No individual matches have been scheduled for this {containerLabel.toLowerCase()} yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {childMatches.map((m: any) => (
                <Link key={m.id} href={`/games/${m.id}`}>
                  <div className="group flex items-stretch rounded-xl border border-slate-800 bg-slate-900/80 hover:border-amber-500/40 hover:bg-slate-900 transition-all cursor-pointer overflow-hidden">
                    {/* Date strip */}
                    <div className="flex flex-col items-center justify-center px-3 py-4 bg-slate-950/60 border-r border-slate-800 min-w-[64px] shrink-0 text-center">
                      <div className="text-white font-bold text-xs font-mono">{m.eventTime}</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">{m.eventDate?.slice(5)}</div>
                      <Badge className={`mt-1.5 text-[9px] px-1 py-0 ${STATUS_COLORS[m.status]} border`}>
                        {m.status}
                      </Badge>
                    </div>
                    {/* VS */}
                    <div className="flex-1 px-4 py-3 flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <span className="truncate">{m.playerA}</span>
                        <span className="text-[10px] font-black text-slate-600 shrink-0">VS</span>
                        <span className="truncate">{m.playerB}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="text-amber-400 font-mono font-semibold">Pool ${(m.totalBetPool || 0).toFixed(2)}</span>
                        <span>{m.openBetsCount || 0} predictions</span>
                      </div>
                    </div>
                    <div className="flex items-center pr-3 shrink-0">
                      <ChevronLeft className="h-4 w-4 text-slate-700 group-hover:text-amber-400 transition-colors rotate-180" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Single match: bet form + stats */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {game.status === 'upcoming' && !hasStarted && (
            <Card className="lg:col-span-2 bg-slate-900 border-primary/20">
              <CardHeader>
                <CardTitle className="text-white">Make Your Prediction</CardTitle>
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
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 5, 10, 20, 50].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setStakeAmount(String(amt))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                          stakeAmount === String(amt)
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-sm shadow-amber-500/10'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={MIN_STAKE}
                    step="0.01"
                    placeholder="Or enter custom amount..."
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
                  disabled={!selectedOutcome || !stakeAmount || parseFloat(stakeAmount) < MIN_STAKE || placeBet.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-12"
                >
                  {placeBet.isPending ? 'Submitting...' : 'Place Prediction'}
                </Button>

                {nearMatches.filter((nm) => !dismissedMatches.has(nm.betId)).length > 0 && myPlacedBetId && (() => {
                  const visible = nearMatches.filter((nm) => !dismissedMatches.has(nm.betId));
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold">
                        <AlertCircle className="h-4 w-4" />
                        Near Matches Available
                      </div>
                      <p className="text-sm text-slate-400">
                        These open predictions are within 20% of your stake. Accept to get matched now — your wallet will be adjusted to the matched amount.
                      </p>
                      {visible.map((nm) => {
                        const myStake = myPlacedStake;
                        const opponentStake = nm.stake;
                        const diff = opponentStake - myStake;
                        const isAccepting = acceptNearMatch.isPending;
                        return (
                          <div key={nm.betId} className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <div className="space-y-0.5">
                                <div className="text-slate-300">
                                  Opponent stake: <span className="font-mono font-bold text-white">${opponentStake.toFixed(2)}</span>
                                </div>
                                <div className="text-slate-400">
                                  Your stake: <span className="font-mono">${myStake.toFixed(2)}</span>
                                  {' · '}Difference: <span className="font-mono text-amber-400">${nm.difference.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                            {diff > 0 ? (
                              <p className="text-xs text-amber-300 bg-amber-500/10 rounded px-2 py-1">
                                ⚡ Accepting will <strong>charge ${diff.toFixed(2)}</strong> from your wallet to top up to ${opponentStake.toFixed(2)}.
                              </p>
                            ) : diff < 0 ? (
                              <p className="text-xs text-teal-300 bg-teal-500/10 rounded px-2 py-1">
                                💰 Accepting will <strong>refund ${Math.abs(diff).toFixed(2)}</strong> to your wallet (matched at ${opponentStake.toFixed(2)}).
                              </p>
                            ) : null}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold h-9"
                                disabled={isAccepting}
                                onClick={() => handleAcceptNearMatch(nm.betId, opponentStake, myStake)}
                              >
                                {isAccepting ? 'Accepting…' : diff > 0 ? `Accept & Pay $${diff.toFixed(2)}` : diff < 0 ? `Accept & Get $${Math.abs(diff).toFixed(2)} Back` : 'Accept Match'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white h-9"
                                disabled={isAccepting}
                                onClick={() => handleRejectNearMatch(nm.betId)}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="space-y-4">
            <Card className="bg-slate-900 border-primary/20">
              <CardHeader><CardTitle className="text-white text-base">Match Activity</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Open Predictions</span>
                  <span className="text-white font-mono">{game.openBetsCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Matched Pairs</span>
                  <span className="text-teal-400 font-mono">{game.matchedBetsCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Pool</span>
                  <span className="text-amber-400 font-mono">${(game.totalBetPool ?? 0).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-primary/20">
              <CardHeader><CardTitle className="text-white text-base">Recent Predictions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {pendingBets.length === 0 && matchedBets.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">No predictions yet. Be the first!</p>
                ) : (
                  [...pendingBets.slice(0, 3), ...matchedBets.slice(0, 3)].map((bet: any) => (
                    <div key={bet.id} className="flex justify-between text-xs">
                      <span className="text-slate-400">${Number(bet.stake ?? 0).toFixed(2)} on {bet.outcome?.includes('player_a') ? game.playerA : game.playerB}</span>
                      <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">{bet.status}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
