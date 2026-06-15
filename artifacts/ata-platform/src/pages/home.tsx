import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { useListUpcomingStreams, useListUpcomingGames } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Countdown } from '@/components/ui/countdown';
import { Play, Trophy, Users, Zap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  useEffect(() => {
    document.title = 'ATA - Premium Sports Streaming & Betting Exchange';
  }, []);

  const { data: upcomingStreams, isLoading: loadingStreams } = useListUpcomingStreams();
  const { data: upcomingGames, isLoading: loadingGames } = useListUpcomingGames();

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary/50 to-slate-900 border border-primary/20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2090&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
        
        <div className="relative px-6 py-24 sm:px-12 sm:py-32 lg:px-16 flex flex-col items-center text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            The Nerve Center of <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-500">African Sports</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl">
            Watch live grassroots Pool and Boxing matches. Bet peer-to-peer in real-time. High stakes, zero clutter.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href="/register">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8">
                Join the Exchange
              </Button>
            </Link>
            <Link href="/streams">
              <Button size="lg" variant="outline" className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10">
                <Play className="mr-2 h-4 w-4" /> Live Streams
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Streams */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center">
            <Zap className="mr-3 h-6 w-6 text-teal-400" /> Live & Upcoming Action
          </h2>
          <Link href="/streams">
            <Button variant="link" className="text-teal-400 hover:text-teal-300">View All</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingStreams ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl bg-slate-800" />)
          ) : upcomingStreams?.length ? (
            upcomingStreams.slice(0, 3).map(stream => (
              <Link key={stream.id} href={`/streams/${stream.id}`}>
                <Card className="group overflow-hidden border-primary/20 bg-card hover:border-teal-500/50 transition-all duration-300 cursor-pointer h-full">
                  <div className="relative aspect-video bg-slate-900">
                    {stream.thumbnailUrl ? (
                      <img src={stream.thumbnailUrl} alt={stream.title} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Play className="h-12 w-12 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      {stream.status === 'live' ? (
                        <span className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span>
                          LIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-400 ring-1 ring-inset ring-teal-500/20">
                          UPCOMING
                        </span>
                      )}
                    </div>
                    {stream.status === 'upcoming' && stream.secondsUntilStart > 0 && (
                      <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur text-amber-500 font-mono text-sm px-2 py-1 rounded border border-amber-500/20">
                        <Countdown seconds={stream.secondsUntilStart} />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stream.sport}</span>
                      {stream.accessPrice ? (
                        <span className="text-sm font-medium text-amber-400">${stream.accessPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-sm font-medium text-teal-400">FREE</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-white group-hover:text-teal-300 transition-colors line-clamp-1">{stream.title}</h3>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No upcoming streams scheduled.
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Games */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center">
            <Trophy className="mr-3 h-6 w-6 text-amber-500" /> Exchange Markets
          </h2>
          <Link href="/games">
            <Button variant="link" className="text-amber-500 hover:text-amber-400">View All</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loadingGames ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-slate-800" />)
          ) : upcomingGames?.length ? (
            upcomingGames.slice(0, 4).map(game => (
              <Link key={game.id} href={`/games/${game.id}`}>
                <Card className="group overflow-hidden border-primary/20 bg-card hover:border-amber-500/50 transition-all duration-300 cursor-pointer">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      <div className="p-5 flex-1 border-b sm:border-b-0 sm:border-r border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{game.sport}</span>
                          <span className="text-xs font-mono text-slate-500">{new Date(game.eventDate).toLocaleDateString()} {game.eventTime}</span>
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
                      <div className="p-5 bg-slate-900/50 sm:w-40 flex flex-col justify-center items-center">
                        <div className="text-xs text-slate-500 mb-1">Pool Size</div>
                        <div className="font-mono font-bold text-xl text-amber-400">${(game.totalBetPool || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No upcoming games scheduled.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
