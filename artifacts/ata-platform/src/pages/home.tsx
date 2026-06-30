import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'wouter';
import { useListUpcomingStreams, useListUpcomingGames } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Countdown } from '@/components/ui/countdown';
import { Play, Trophy, Zap, Megaphone, MapPin, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import tigoPesa from '@assets/6491beebed5bfcd9b9608baf_tigo_pesa_1782470222582.webp';
import airtelMoney from '@assets/airtel-money-copy_1782470222583.png';
import mastercard from '@assets/mastercard-symbol_transparentbg_1782470222583.png';
import mpesa from '@assets/m-pesa-seeklogo_1782470222583.png';
import visa from '@assets/Visa_Brandmark_Blue_RGB_2021_1782470222584.png';
import ataLogo from '@assets/cropped-ATA_logo-removebg-preview_1782471649356.png';

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

const SLIDE_DURATION = 6000;

const sliderStyles = `
  @keyframes kenBurns {
    from { transform: scale(1); }
    to   { transform: scale(1.08); }
  }
  @keyframes slideInRight {
    from { transform: translateX(6%); opacity: 0; }
    to   { transform: translateX(0);  opacity: 1; }
  }
  @keyframes slideInLeft {
    from { transform: translateX(-6%); opacity: 0; }
    to   { transform: translateX(0);   opacity: 1; }
  }
  @keyframes slideOutLeft {
    from { transform: translateX(0);   opacity: 1; }
    to   { transform: translateX(-6%); opacity: 0; }
  }
  @keyframes slideOutRight {
    from { transform: translateX(0);  opacity: 1; }
    to   { transform: translateX(6%); opacity: 0; }
  }
  @keyframes contentFadeUp {
    from { transform: translateY(14px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
`;

function HeroSlider({ slides }: { slides: Slide[] }) {
  const [current, setCurrent] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((index: number, dir: 'next' | 'prev' = 'next') => {
    if (transitioning || index === current) return;
    setDirection(dir);
    setLeaving(current);
    setTransitioning(true);
    setCurrent(index);
    setTimeout(() => {
      setLeaving(null);
      setTransitioning(false);
    }, 750);
  }, [transitioning, current]);

  const next = useCallback(() => {
    goTo((current + 1) % slides.length, 'next');
  }, [current, slides.length, goTo]);

  const prevSlide = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length, 'prev');
  }, [current, slides.length, goTo]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(next, SLIDE_DURATION);
    return () => clearInterval(t);
  }, [next, slides.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prevSlide();
    touchStartX.current = null;
  };

  const slide = slides[current];
  const enterAnim = direction === 'next' ? 'slideInRight' : 'slideInLeft';
  const exitAnim  = direction === 'next' ? 'slideOutLeft' : 'slideOutRight';

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-primary/20"
      style={{ height: 'clamp(280px, 55vw, 520px)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{sliderStyles}</style>

      {slides.map((s, i) => {
        const isActive = i === current;
        const isLeaving = i === leaving;
        if (!isActive && !isLeaving) return null;
        return (
          <div
            key={s.id}
            className="absolute inset-0"
            style={{
              zIndex: isActive ? 2 : 1,
              animation: isActive && transitioning
                ? `${enterAnim} 0.75s cubic-bezier(0.4,0,0.2,1) forwards`
                : isLeaving
                  ? `${exitAnim} 0.75s cubic-bezier(0.4,0,0.2,1) forwards`
                  : undefined,
            }}
          >
            {s.imageUrl ? (
              <img
                key={isActive ? 'active' : 'leaving'}
                src={s.imageUrl}
                alt={s.title}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  opacity: 0.96,
                  transformOrigin: 'center center',
                  animation: isActive
                    ? `kenBurns ${SLIDE_DURATION}ms ease-in-out forwards`
                    : undefined,
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary/50 to-slate-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/10 via-transparent to-transparent" />
          </div>
        );
      })}

      <div
        className="absolute inset-0 flex flex-col items-center justify-end text-center px-6 sm:px-12 lg:px-20 pb-10 sm:pb-16"
        style={{ zIndex: 10 }}
      >
        <div
          key={current}
          style={{ animation: 'contentFadeUp 0.6s cubic-bezier(0.4,0,0.2,1) forwards' }}
          className="flex flex-col items-center"
        >
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-7xl leading-tight drop-shadow-lg">
            {slide.title.split(' ').map((word, wi) => (
              wi % 3 === 2
                ? <span key={wi} className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-500"> {word}</span>
                : <span key={wi}> {word}</span>
            ))}
          </h1>

          {slide.subtitle && (
            <p className="mt-3 sm:mt-6 max-w-2xl text-sm sm:text-xl text-slate-300 drop-shadow px-2">
              {slide.subtitle}
            </p>
          )}

          {slide.buttonText && slide.buttonUrl && (
            <div className="mt-4 sm:mt-8 flex flex-row items-center justify-center gap-3 sm:gap-x-6">
              <Link href={slide.buttonUrl}>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 sm:px-8 shadow-lg shadow-amber-500/20 transition-all hover:scale-105">
                  {slide.buttonText}
                </Button>
              </Link>
              <Link href="/streams">
                <Button size="sm" variant="outline" className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10 transition-all hover:scale-105 px-4 sm:px-6">
                  <Play className="mr-2 h-4 w-4" /> Live Streams
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <div>
          <button
            onClick={prevSlide}
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
        </div>
      )}
    </section>
  );
}

function DefaultHero() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary/50 to-slate-900 border border-primary/20 flex flex-col items-center justify-end text-center"
      style={{ height: 'clamp(280px, 55vw, 520px)' }}
    >
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2090&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="relative px-6 sm:px-12 lg:px-16 pb-10 sm:pb-16 flex flex-col items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-tight drop-shadow-lg">
          The Nerve Center of{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-amber-500">African Sports</span>
        </h1>
        <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-xl text-slate-300 drop-shadow">
          Watch live grassroots Pool and Boxing matches. Bet peer-to-peer in real-time. High stakes, zero clutter.
        </p>
        <div className="mt-5 sm:mt-8 flex flex-row items-center justify-center gap-3 sm:gap-x-6">
          <Link href="/register">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 sm:px-8 shadow-lg shadow-amber-500/20 transition-all hover:scale-105">
              Join the movement
            </Button>
          </Link>
          <Link href="/streams">
            <Button size="sm" variant="outline" className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10 transition-all hover:scale-105 px-4 sm:px-6">
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

  const liveCount = upcomingStreams.filter((s: any) => s.status === 'live').length;
  const totalPool = upcomingGames.reduce((sum: number, g: any) => sum + (g.totalBetPool || 0), 0);
  const totalOpenBets = upcomingGames.reduce((sum: number, g: any) => sum + (g.openBetsCount || 0), 0);

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

      {/* Stats strip */}
      {(!loadingStreams || !loadingGames) && (
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-3 px-5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-slate-400">Live: <span className="font-bold text-white">{liveCount}</span></span>
          </div>
          <div className="text-sm text-slate-400">Events: <span className="font-bold text-white">{upcomingStreams.length}</span></div>
          {isAuthenticated && (
            <>
              <div className="text-sm text-slate-400">Pool: <span className="font-bold text-amber-400">${totalPool.toFixed(2)}</span></div>
              <div className="text-sm text-slate-400">Open bets: <span className="font-bold text-teal-400">{totalOpenBets}</span></div>
            </>
          )}
        </div>
      )}

      {/* Upcoming Streams */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white uppercase">
            Upcoming Events
          </h2>
          <Link href="/streams">
            <Button variant="link" className="text-teal-400 hover:text-teal-300">View All</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingStreams ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl bg-slate-800" />)
          ) : upcomingStreams?.length ? (
            upcomingStreams.slice(0, 6).map((stream: any, i: number) => (
              <Link key={stream.id} href="/live" className="card-enter block" style={{ animationDelay: `${i * 70}ms` }}>
                <Card className="group overflow-hidden border-primary/20 bg-card hover:border-teal-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer h-full">
                  <div className="relative aspect-video bg-slate-900 overflow-hidden">
                    {stream.thumbnailUrl ? (
                      <img src={stream.thumbnailUrl} alt={stream.title} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Play className="h-12 w-12 text-slate-600" />
                      </div>
                    )}
                    {/* Watch overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-950 bg-amber-400 px-4 py-1.5 rounded-full translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        <Play className="h-3.5 w-3.5 fill-current" /> Watch
                      </span>
                    </div>
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

      {/* Payment Partners — marquee */}
      <section className="overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex items-center gap-10 animate-marquee w-max">
          {[
            { src: ataLogo,     alt: 'ATA Sports Live' },
            { src: mastercard,  alt: 'Mastercard' },
            { src: visa,        alt: 'Visa' },
            { src: airtelMoney, alt: 'Airtel Money' },
            { src: mpesa,       alt: 'M-Pesa' },
            { src: tigoPesa,    alt: 'Tigo Pesa' },
            { src: ataLogo,     alt: 'ATA Sports Live 2' },
            { src: mastercard,  alt: 'Mastercard 2' },
            { src: visa,        alt: 'Visa 2' },
            { src: airtelMoney, alt: 'Airtel Money 2' },
            { src: mpesa,       alt: 'M-Pesa 2' },
            { src: tigoPesa,    alt: 'Tigo Pesa 2' },
          ].map(({ src, alt }) => (
            <img key={alt} src={src} alt={alt} className="h-[40px] w-auto object-contain opacity-60 hover:opacity-100 transition-opacity shrink-0" />
          ))}
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
              upcomingGames.slice(0, 4).map((game: any, i: number) => (
                <Link key={game.id} href={`/games/${game.id}`} className="card-enter block" style={{ animationDelay: `${i * 80}ms` }}>
                  <Card className="group overflow-hidden border-primary/20 bg-card hover:border-amber-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer">
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
                          <div className="flex justify-between items-center gap-2">
                            <div className="text-center flex-1 min-w-0">
                              <div className="font-bold text-base text-white truncate group-hover:text-teal-300 transition-colors">{game.playerA}</div>
                            </div>
                            <div className="px-2 py-1 text-[10px] font-black text-slate-600 bg-slate-800 rounded shrink-0">VS</div>
                            <div className="text-center flex-1 min-w-0">
                              <div className="font-bold text-base text-white truncate group-hover:text-amber-300 transition-colors">{game.playerB}</div>
                            </div>
                          </div>
                          {(game.city || game.country) && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{[game.city, game.country].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="p-4 bg-slate-900/50 sm:w-36 flex flex-col justify-center items-center gap-1">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pool</div>
                          <div className="font-mono font-bold text-xl text-amber-400">${(game.totalBetPool || 0).toFixed(2)}</div>
                          {(game.openBetsCount ?? 0) > 0 && (
                            <div className="text-[10px] text-teal-400 font-medium">{game.openBetsCount} open bets</div>
                          )}
                          <div className="mt-1 text-[10px] font-semibold text-slate-700 group-hover:text-amber-400 transition-colors">Bet Now →</div>
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
