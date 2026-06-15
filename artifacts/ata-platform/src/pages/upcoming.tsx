import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarClock, Clock, MapPin, Users, ChevronRight } from 'lucide-react';

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
  viewerCount: number | null;
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

const sportColor: Record<string, string> = {
  pool: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  boxing: 'text-red-400 bg-red-500/10 border-red-500/20',
  football: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  athletics: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  basketball: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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
      href: `/streams/${s.id}`,
      accessPrice: s.accessPrice,
      id: s.id,
    });
  });

  (games.data || []).forEach((g) => {
    const dt = new Date(`${g.eventDate}T${g.eventTime}`);
    events.push({
      key: `game-${g.id}`,
      type: 'game',
      date: dt,
      sport: g.sport,
      title: `${g.playerA} vs ${g.playerB}`,
      description: `${g.sport.charAt(0).toUpperCase() + g.sport.slice(1)} match`,
      location: [g.city, g.country].filter(Boolean).join(', ') || null,
      href: `/games/${g.id}`,
      id: g.id,
    });
  });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    events,
    isLoading: streams.isLoading || games.isLoading,
  };
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

export default function Upcoming() {
  useEffect(() => { document.title = 'Upcoming Events - ATA Platform'; }, []);

  const { events, isLoading } = useUpcomingEvents();
  const now = new Date();
  const grouped = groupByDate(events);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-teal-400" /> Upcoming Events
        </h1>
        <p className="text-slate-400 text-sm mt-1">All scheduled streams and matches, ordered by date</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl bg-slate-800" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
          No upcoming events scheduled right now. Check back soon.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateLabel, dayEvents]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 whitespace-nowrap">{dateLabel}</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="space-y-3">
                {dayEvents.map((event) => {
                  const sc = sportColor[event.sport] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                  const secsLeft = Math.max(0, Math.floor((event.date.getTime() - now.getTime()) / 1000));
                  return (
                    <Link key={event.key} href={event.href}>
                      <div className="group flex items-start gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-teal-500/40 hover:bg-slate-900 transition-all cursor-pointer">
                        {/* Time column */}
                        <div className="shrink-0 w-16 text-center pt-0.5">
                          <div className="text-white font-mono font-bold text-base">
                            {event.date.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-teal-400 text-xs font-mono mt-0.5">
                            in {formatDuration(secsLeft)}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="shrink-0 w-px self-stretch bg-slate-800 mx-1" />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc}`}>
                              {event.sport}
                            </span>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${event.type === 'stream' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                              {event.type === 'stream' ? 'Stream' : 'Match'}
                            </span>
                          </div>
                          <h3 className="text-white font-semibold text-sm group-hover:text-teal-300 transition-colors">{event.title}</h3>
                          {event.description && (
                            <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {event.location}
                              </span>
                            )}
                            {event.type === 'stream' && event.accessPrice != null && (
                              <span className="text-amber-400 font-mono font-semibold">${event.accessPrice.toFixed(2)} access</span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-teal-400 shrink-0 mt-1 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
