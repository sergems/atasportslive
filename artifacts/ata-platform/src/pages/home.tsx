import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'wouter';
import { useListUpcomingStreams, useListUpcomingGames } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Countdown } from '@/components/ui/countdown';
import { Play, Trophy, Zap, Megaphone, MapPin, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Announcement { id: number; title: string; content: string; priority: number; }
interface Slide {
  id: number;
  title: string;
  subtitle: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

function useActiveAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ['announcements', 'active'],
    queryFn: async () => {
      const r = await fetch('/api/announcements/active');
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
}

function useHeroSlides() {
  return useQuery<Slide[]>({
    queryKey: ['hero-slides'],
    queryFn: async () => {
      const r = await fetch('/api/slides');
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
}

function HeroSlider({ slides }: { slides: Slide[] }) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const goTo = useCallback((index: number, dir: 'next' | 'prev' = 'next') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 400);
  }, [animating]);

  const next = useCallback(() => {
    goTo((current + 1) % slides.length, 'next');
  }, [current, slides.length, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length, 'prev');
  }, [current, slides.length, goTo]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next, slides.length]);

  const slide = slides[current];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/20" style={{ minHeight: 420 }}>
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-all duration-700"
          style={{
            opacity: i === current ? 1 : 0,
            transform: i === current
              ? 'scale(1) translateX(0)'
              : animating && direction === 'next'
                ? (i === (current - 1 + slides.length) % slides.length ? 'scale(1.04) translateX(-3%)' : 'scale(0.98) translateX(3%)')
                : 'scale(0.98)',
            zIndex: i === current ? 1 : 0,
            pointerEvents: i === current ? 'auto' : 'none',
          }}
        >
          {s.imageUrl ? (
            <img
              src={s.imageUrl}
              alt={s.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'brightness(0.45)' }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/50 to-slate-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/20" />
        </div>
      ))}

      <div
        className="relative z-10 px-6 py-24 sm:px-12 sm:py-32 lg:px-20 flex flex-col items-center text-center transition-all duration-500"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating ? `translateY(${direction === 'next' ? '12px' : '-12px'})` : 'translateY(0)',
        }}
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-tight drop-shadow-lg">
          {slide.title.split(' ').map((word, wi) => (
            wi % 3 === 2
              ? <span key={wi} className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-500"> {word}</span>
              : <span key={wi}> {word}</span>
          ))}
        </h1>

        {slide.subtitle && (
          <p className="mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl drop-shadow">
            {slide.subtitle}
          </p>
        )}

        {slide.buttonText && slide.buttonUrl && (
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link href={slide.buttonUrl}>
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 shadow-lg shadow-amber-500/20 transition-all hover:scale-105">
                {slide.buttonText}
              </Button>
            </Link>
            <Link href="/streams">
              <Button size="lg" variant="outline" className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10 transition-all hover:scale-105">
                <Play className="mr-2 h-4 w-4" /> Live Streams
              </Button>
            </Link>
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-all hover:scale-110"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 border border-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-all hover:scale-110"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > current ? 'next' : 'prev')}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === current ? 24 : 8,
                  height: 8,
                  background: i === current ? 'rgb(45 212 191)' : 'rgba(255,255,255,0.25)',
                }}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <div className="absolute top-5 right-5 z-20 text-xs font-mono text-white/40">
            {current + 1} / {slides.length}
          </div>
        </>
      )}
    </section>
  );
}

function DefaultHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary/50 to-slate-900 border border-primary/20">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2090&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="relative px-6 py-24 sm:px-12 sm:py-32 lg:px-16 flex flex-col items-center text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          The Nerve Center of{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-500">African Sports</span>
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
  );
}

export default function Home() {
  useEffect(() => {
    document.title = 'ATA Sports Live — Kampala\'s Premier Sports Streaming & Betting Exchange';
  }, []);

  const { isAuthenticated } = useAuth();
  const { data: _upcomingStreams, isLoading: loadingStreams } = useListUpcomingStreams();
  const { data: _upcomingGames, isLoading: loadingGames } = useListUpcomingGames();
  const { data: announcements } = useActiveAnnouncements();
  const { data: slides, isLoading: loadingSlides } = useHeroSlides();
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const upcomingStreams = Array.isArray(_upcomingStreams) ? _upcomingStreams : [];
  const upcomingGames = Array.isArray(_upcomingGames) ? _upcomingGames : [];
  const visibleAnnouncements = (announcements || []).filter((a) => !dismissedIds.has(a.id));
  const activeSlides = Array.isArray(slides) ? slides : [];

  return (
    <div className="space-y-10">
      {/* Announcements Banner */}
      {visibleAnnouncements.length > 0 && (
        <section className="space-y-2">
          {visibleAnnouncements.map((a) => (
            <div key={a.id} className="relative flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 pr-10">
              <Megaphone className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-orange-300 text-sm">{a.title}: </span>
                <span className="text-slate-300 text-sm">{a.content}</span>
              </div>
              <button
                onClick={() => setDismissedIds((s) => new Set([...s, a.id]))}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Hero — animated slider or default fallback */}
      {loadingSlides ? (
        <Skeleton className="w-full rounded-3xl bg-slate-800" style={{ minHeight: 420 }} />
      ) : activeSlides.length > 0 ? (
        <HeroSlider slides={activeSlides} />
      ) : (
        <DefaultHero />
      )}

      {/* Upcoming Streams */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center">
            <Zap className="mr-3 h-6 w-6 text-teal-400" /> Live & Upcoming Action
          </h2>
          <Link href="/streams">
            <Button variant="link" className="text-teal-400 hover:text-teal-300">View All</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingStreams ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl bg-slate-800" />)
          ) : upcomingStreams?.length ? (
            upcomingStreams.slice(0, 6).map((stream: any) => (
              <Link key={stream.id} href="/live">
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
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />LIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-400 ring-1 ring-inset ring-teal-500/20">UPCOMING</span>
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
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">{stream.sport}</span>
                      {stream.accessPrice ? (
                        <span className="text-sm font-medium text-amber-400">${stream.accessPrice.toFixed(2)}</span>
                      ) : (
                        <span className="text-sm font-medium text-teal-400">FREE</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-white group-hover:text-teal-300 transition-colors line-clamp-1">{stream.title}</h3>
                    {(stream.city || stream.country) && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{[stream.city, stream.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(stream.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {stream.endTime ? ` → ${new Date(stream.endTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                    </p>
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

      {/* Exchange Markets — logged-in users only */}
      {isAuthenticated && (
        <section>
          <div className="flex items-center justify-between mb-6">
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
              upcomingGames.slice(0, 4).map((game: any) => (
                <Link key={game.id} href={`/games/${game.id}`}>
                  <Card className="group overflow-hidden border-primary/20 bg-card hover:border-amber-500/50 transition-all duration-300 cursor-pointer">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className="p-5 flex-1 border-b sm:border-b-0 sm:border-r border-slate-800">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">{game.sport}</span>
                            <span className="text-xs font-mono text-slate-500">
                              {game.eventDate} {game.eventTime}
                              {game.eventEndDate ? ` → ${game.eventEndDate}` : ''}
                            </span>
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
                          {(game.city || game.country) && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{[game.city, game.country].filter(Boolean).join(', ')}
                            </p>
                          )}
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
      )}
    </div>
  );
}
