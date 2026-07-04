import React, { useEffect, useState, useMemo } from 'react';
import { useSEO, makeBreadcrumb, SITE_URL } from '@/lib/seo';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, MapPin, ChevronRight, Tv, Swords } from 'lucide-react';
import { useAdSlots, AdCard, HorizontalAdBanner } from '@/components/ads';

interface UpcomingStream {
  id: number;
  title: string;
  description: string | null;
  sport: string;
  thumbnailUrl: string | null;
  startTime: string;
  secondsUntilStart: number;
  accessPrice: number;
  city: string | null;
  country: string | null;
}

interface UpcomingGame {
  id: number;
  sport: string;
  playerA: string;
  playerB: string;
  eventDate: string;
  eventTime: string;
  city: string | null;
  country: string | null;
  status: string;
}

interface UnifiedEvent {
  key: string;
  type: 'stream' | 'game';
  date: Date;
  sport: string;
  title: string;
  description: string;
  location: string | null;
  href: string;
  accessPrice?: number;
  id: number;
}

const sportColor: Record<string, { pill: string; dot: string }> = {
  pool:       { pill: 'text-teal-400 bg-teal-500/10 border-teal-500/30',         dot: 'bg-teal-400' },
  boxing:     { pill: 'text-red-400 bg-red-500/10 border-red-500/30',            dot: 'bg-red-400' },
  darts:      { pill: 'text-violet-400 bg-violet-500/10 border-violet-500/30',   dot: 'bg-violet-400' },
  fifa:       { pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  chess:      { pill: 'text-blue-400 bg-blue-500/10 border-blue-500/30',         dot: 'bg-blue-400' },
  futsal:     { pill: 'text-orange-400 bg-orange-500/10 border-orange-500/30',   dot: 'bg-orange-400' },
  tournament: { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/30',      dot: 'bg-amber-400' },
  other:      { pill: 'text-slate-400 bg-slate-500/10 border-slate-500/30',      dot: 'bg-slate-400' },
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Now';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function useUpcomingEvents() {
  const streams = useQuery<UpcomingStream[]>({
    queryKey: ['streams', 'upcoming'],
    queryFn: () => fetch('/api/streams/upcoming').then((r) => r.json()),
    refetchInterval: 60000,
  });
  const games = useQuery<UpcomingGame[]>({
    queryKey: ['games', 'upcoming'],
    queryFn: () => fetch('/api/games/upcoming').then((r) => r.json()),
    refetchInterval: 60000,
  });

  const events: UnifiedEvent[] = [];
  (streams.data || []).forEach((s) => {
    events.push({
      key: `stream-${s.id}`,
      type: 'stream',
      date: new Date(s.startTime),
      sport: s.sport,
      title: s.title,
      description: s.description || '',
      location: [s.city, s.country].filter(Boolean).join(', ') || null,
      href: `/live`,
      accessPrice: s.accessPrice,
      id: s.id,
    });
  });
  (games.data || []).forEach((g) => {
    events.push({
      key: `game-${g.id}`,
      type: 'game',
      date: new Date(`${g.eventDate}T${g.eventTime}`),
      sport: g.sport,
      title: `${g.playerA} vs ${g.playerB}`,
      description: `${g.sport.charAt(0).toUpperCase() + g.sport.slice(1)} match`,
      location: [g.city, g.country].filter(Boolean).join(', ') || null,
      href: `/games/${g.id}`,
      id: g.id,
    });
  });
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { events, isLoading: streams.isLoading || games.isLoading };
}

function groupByDate(events: UnifiedEvent[]): [string, UnifiedEvent[]][] {
  const map = new Map<string, UnifiedEvent[]>();
  events.forEach((e) => {
    const key = e.date.toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  });
  return Array.from(map.entries());
}

function EventCard({ event, now }: { event: UnifiedEvent; now: Date }) {
  const sc = sportColor[event.sport] ?? { pill: 'text-slate-400 bg-slate-500/10 border-slate-500/30', dot: 'bg-slate-400' };
  const secsLeft = Math.max(0, Math.floor((event.date.getTime() - now.getTime()) / 1000));
  const timeStr = event.date.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
  const isStream = event.type === 'stream';

  return (
    <Link href={event.href}>
      <div className="group flex items-stretch gap-0 rounded-2xl border border-slate-800 bg-slate-900/70 hover:border-teal-500/40 hover:bg-slate-900 active:scale-[0.99] transition-all duration-150 cursor-pointer overflow-hidden">
        <div className="flex flex-col items-center justify-center px-3 sm:px-4 py-4 bg-slate-950/60 min-w-[64px] shrink-0 border-r border-slate-800">
          <div className="text-white font-bold text-sm font-mono leading-none">{timeStr}</div>
          <div className="text-teal-400 text-[10px] font-mono mt-1.5 font-semibold">
            {formatCountdown(secsLeft)}
          </div>
        </div>
        <div className="flex-1 min-w-0 px-3 sm:px-4 py-3.5 flex flex-col justify-center gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
              {event.sport}
            </span>
            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isStream
                ? 'text-violet-400 bg-violet-500/10 border-violet-500/30'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
            }`}>
              {isStream ? <Tv className="h-2.5 w-2.5" /> : <Swords className="h-2.5 w-2.5" />}
              {isStream ? 'Stream' : 'Match'}
            </span>
            {isStream && event.accessPrice != null && (
              <span className="text-amber-400 font-mono font-bold text-[10px]">
                ${event.accessPrice.toFixed(2)}
              </span>
            )}
          </div>
          <h3 className="text-white font-semibold text-sm leading-snug group-hover:text-teal-300 transition-colors line-clamp-1">
            {event.title}
          </h3>
          {event.location && (
            <p className="flex items-center gap-1 text-slate-500 text-[10px]">
              <MapPin className="h-2.5 w-2.5 shrink-0" /> {event.location}
            </p>
          )}
        </div>
        <div className="flex items-center pr-3 sm:pr-4 shrink-0">
          <ChevronRight className="h-4 w-4 text-slate-700 group-hover:text-teal-400 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

export default function Upcoming() {
  useSEO({
    title: 'Upcoming Events',
    path: '/upcoming',
    description: 'Upcoming Pool, Boxing, Darts, FIFA, Chess and Futsal matches streaming live on ATA Sports Live. View schedules, countdowns, and book your stream access in advance.',
    jsonLd: makeBreadcrumb([
      { name: 'Home', url: SITE_URL },
      { name: 'Upcoming Events', url: `${SITE_URL}/upcoming` },
    ]),
  });

  const { events, isLoading } = useUpcomingEvents();
  const adSlots = useAdSlots();
  const now = new Date();

  const [sportFilter, setSportFilter] = useState('all');

  const FIXED_SPORTS = ['pool', 'boxing', 'darts', 'fifa', 'chess', 'futsal'];

  const availableSports = FIXED_SPORTS;

  const filteredEvents = useMemo(() => {
    if (sportFilter === 'all') return events;
    return events.filter((e) => e.sport === sportFilter);
  }, [events, sportFilter]);

  const grouped = groupByDate(filteredEvents);

  const mainContent = (
    <div className="space-y-6">
      {/* Mobile top ads */}
      {!adSlots.hideOnMobile && (
        <div className="lg:hidden space-y-2">
          <HorizontalAdBanner slotKey="left_1" slot={adSlots.left_1} />
          <HorizontalAdBanner slotKey="right_1" slot={adSlots.right_1} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">Upcoming Events</h1>
          {!isLoading && filteredEvents.length > 0 && (
            <span className="text-xs font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full px-2 py-0.5">
              {filteredEvents.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto">
          {availableSports.map((s) => {
            const sc = sportColor[s] ?? { pill: 'text-slate-400 bg-slate-500/10 border-slate-500/30', dot: 'bg-slate-400' };
            const active = sportFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSportFilter(sportFilter === s ? 'all' : s)}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border shrink-0 ${
                  active ? `${sc.pill} border-current` : 'text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                {s.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-slate-800" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {sportFilter === 'all'
              ? 'No upcoming events right now. Check back soon.'
              : `No upcoming ${sportFilter.toUpperCase()} events. Try another category.`}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateLabel, dayEvents], gi) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap px-1">
                  {dateLabel}
                </span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="space-y-2.5">
                {dayEvents.map((event) => (
                  <EventCard key={event.key} event={event} now={now} />
                ))}
              </div>
              {/* Mobile mid-feed ads every 2nd group */}
              {!adSlots.hideOnMobile && gi % 2 === 1 && (
                <div className="lg:hidden mt-4 space-y-2">
                  <HorizontalAdBanner slotKey="left_2" slot={adSlots.left_2} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile bottom ads */}
      {!adSlots.hideOnMobile && (
        <div className="lg:hidden space-y-2 pt-2">
          <HorizontalAdBanner slotKey="left_3" slot={adSlots.left_3} />
          <HorizontalAdBanner slotKey="right_2" slot={adSlots.right_2} />
          <HorizontalAdBanner slotKey="right_3" slot={adSlots.right_3} />
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {/* Desktop 3-column layout */}
      <div className="hidden lg:flex items-start gap-4 xl:gap-6">
        {/* Left ads */}
        <aside className="w-44 xl:w-48 shrink-0 sticky top-8 space-y-3">
          <AdCard slotKey="left_1" slot={adSlots.left_1} />
          <AdCard slotKey="left_2" slot={adSlots.left_2} />
          <AdCard slotKey="left_3" slot={adSlots.left_3} />
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">{mainContent}</div>

        {/* Right ads */}
        <aside className="w-44 xl:w-48 shrink-0 sticky top-8 space-y-3">
          <AdCard slotKey="right_1" slot={adSlots.right_1} />
          <AdCard slotKey="right_2" slot={adSlots.right_2} />
          <AdCard slotKey="right_3" slot={adSlots.right_3} />
        </aside>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">{mainContent}</div>
    </div>
  );
}
