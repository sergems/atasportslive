import React, { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useGetWallet, useListMyBets, useListTransactions } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Activity, TrendingUp, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { user } = useAuth();
  
  useEffect(() => {
    document.title = 'Dashboard - ATA Platform';
  }, []);

  const { data: wallet, isLoading: loadingWallet } = useGetWallet();
  const { data: recentBets, isLoading: loadingBets } = useListMyBets({ limit: 5 });
  const { data: recentTx, isLoading: loadingTx } = useListTransactions({ limit: 5 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back, {user?.fullName}</h1>
        <p className="text-slate-400 mt-1">Here's your account overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            {loadingWallet ? (
              <Skeleton className="h-8 w-32 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold font-mono text-white">${wallet?.balance?.toFixed(2) || '0.00'}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Available: ${wallet?.availableBalance?.toFixed(2) || '0.00'}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Pending Bets</CardTitle>
            <Activity className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
             {loadingWallet ? (
              <Skeleton className="h-8 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold font-mono text-white">${wallet?.pendingBalance?.toFixed(2) || '0.00'}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Locked in active markets</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Withdrawable</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
             {loadingWallet ? (
              <Skeleton className="h-8 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold font-mono text-white">${wallet?.withdrawableBalance?.toFixed(2) || '0.00'}</div>
            )}
            <div className="mt-2">
              <Link href="/wallet">
                <Button size="sm" variant="outline" className="h-7 text-xs border-teal-500/50 text-teal-400">Manage Wallet</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Activity className="mr-2 h-5 w-5 text-amber-500" /> Recent Bets
            </CardTitle>
            <Link href="/bets">
              <Button variant="link" className="text-amber-500 text-sm h-auto p-0">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingBets ? (
               <div className="space-y-4">
                 {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full bg-slate-800" />)}
               </div>
            ) : recentBets?.bets?.length ? (
              <div className="space-y-4">
                {recentBets.bets.map(bet => (
                  <Link key={bet.id} href={`/games/${bet.gameId}`}>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/80 transition-all cursor-pointer">
                      <div>
                        <div className="font-medium text-white text-sm hover:text-amber-400 transition-colors">{bet.game?.playerA} vs {bet.game?.playerB}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Pick: {bet.outcome === 'player_a_wins' ? bet.game?.playerA : bet.outcome === 'player_b_wins' ? bet.game?.playerB : bet.outcome.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-white">${bet.stake.toFixed(2)}</div>
                        <div className={`text-[10px] font-bold mt-1 uppercase ${
                          bet.status === 'won' ? 'text-teal-400' : 
                          bet.status === 'lost' ? 'text-red-400' : 
                          bet.status === 'pending' ? 'text-amber-400' : 'text-slate-400'
                        }`}>{bet.status}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">No recent bets found.</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <History className="mr-2 h-5 w-5 text-teal-500" /> Recent Transactions
            </CardTitle>
            <Link href="/wallet">
              <Button variant="link" className="text-teal-500 text-sm h-auto p-0">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
             {loadingTx ? (
               <div className="space-y-4">
                 {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full bg-slate-800" />)}
               </div>
            ) : recentTx?.transactions?.length ? (
              <div className="space-y-4">
                {recentTx.transactions.map(tx => (
                  <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div>
                      <div className="font-medium text-white text-sm capitalize">{tx.type.replace('_', ' ')}</div>
                      <div className="text-xs text-slate-500 mt-1">{new Date(tx.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono text-sm ${['deposit', 'bet_win', 'bet_refund'].includes(tx.type) ? 'text-teal-400' : 'text-white'}`}>
                        {['deposit', 'bet_win', 'bet_refund'].includes(tx.type) ? '+' : '-'}${tx.amount.toFixed(2)}
                      </div>
                      <div className={`text-[10px] font-bold mt-1 uppercase ${
                        tx.status === 'completed' ? 'text-teal-400' : 
                        tx.status === 'failed' || tx.status === 'rejected' ? 'text-red-400' : 'text-amber-400'
                      }`}>{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">No recent transactions found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
