import React, { useEffect, useState, useMemo } from 'react';
import { useSEO, makeBreadcrumb, SITE_URL } from '@/lib/seo';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, MapPin, Tv, Swords, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
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

interface Fixture {
  key: string;
  type: 'stream' | 'game';
  date: Date;
  sport: string;
  title: string;
  teamA?: string;
  teamB?: string;
  location: string | null;
  href: string;
  accessPrice?: number;
  id: number;
}

const SPORT_COLORS: Record<string, { pill: string; dot: string; badge: string }> = {
  pool:       { pill: 'text-teal-400 bg-teal-500/10 border-teal-500/30',         dot: 'bg-teal-400',     badge: 'bg-teal-500' },
  boxing:     { pill: 'text-red-400 bg-red-500/10 border-red-500/30',            dot: 'bg-red-400',      badge: 'bg-red-500' },
  football:   { pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400', badge: 'bg-emerald-500' },
  athletics:  { pill: 'text-orange-400 bg-orange-500/10 border-orange-500/30',   dot: 'bg-orange-400',  badge: 'bg-orange-500' },
  basketball: { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/30',      dot: 'bg-amber-400',   badge: 'bg-amber-500' },
};

function getSportColor(sport: string) {
  return SPORT_COLORS[sport?.toLowerCase()] ?? {
    pill: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    dot: 'bg-slate-400',
    badge: 'bg-slate-500',
  };
}

function useFixtures() {
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

  const fixtures: Fixture[] = useMemo(() => {
    const list: Fixture[] = [];
    (streams.data || []).forEach((s) => {
      list.push({
        key: `stream-${s.id}`,
        type: 'stream',
        date: new Date(s.startTime),
        sport: s.sport,
        title: s.title,
        location: [s.city, s.country].filter(Boolean).join(', ') || null,
        href: `/live`,
        accessPrice: s.accessPrice,
        id: s.id,
      });
    });
    (games.data || []).forEach((g) => {
      list.push({
        key: `game-${g.id}`,
        type: 'game',
        date: new Date(`${g.eventDate}T${g.eventTime}`),
        sport: g.sport,
        title: `${g.playerA} vs ${g.playerB}`,
        teamA: g.playerA,
        teamB: g.playerB,
        location: [g.city, g.country].filter(Boolean).join(', ') || null,
        href: `/games/${g.id}`,
        id: g.id,
      });
    });
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return list;
  }, [streams.data, games.data]);

  const sports = useMemo(() => {
    const seen = new Set<string>();
    fixtures.forEach((f) => seen.add(f.sport));
    return ['all', ...Array.from(seen)];
  }, [fixtures]);

  return { fixtures, sports, isLoading: streams.isLoading || games.isLoading };
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatWeekRange(monday: Date) {
  const sunday = addDays(monday, 6);
  const fmtOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const mo = monday.toLocaleDateString('en-UG', fmtOpts);
  const su = sunday.toLocaleDateString('en-UG', fmtOpts);
  const yr = sunday.getFullYear();
  return `${mo} – ${su}, ${yr}`;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function FixtureRow({ fixture }: { fixture: Fixture }) {
  const sc = getSportColor(fixture.sport);
  const timeStr = fixture.date.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' });
  const isGame = fixture.type === 'game';

  return (
    <Link href={fixture.href}>
      <div className="group flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl border border-slate-800/60 bg-slate-900/50 hover:border-teal-500/40 hover:bg-slate-900 active:scale-[0.99] transition-all duration-150 cursor-pointer">
        <div className="shrink-0 text-center min-w-[48px]">
          <div className="text-white font-mono font-bold text-sm leading-none">{timeStr}</div>
        </div>
        <div className="h-8 w-px bg-slate-800 shrink-0" />
        <div className="shrink-0 hidden xs:flex">
          <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
            {fixture.sport}
          </span>
        </div>
        <div className="shrink-0">
          {isGame
            ? <Swords className="h-3.5 w-3.5 text-amber-400" />
            : <Tv className="h-3.5 w-3.5 text-violet-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          {isGame && fixture.teamA && fixture.teamB ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white font-semibold text-sm group-hover:text-teal-300 transition-colors truncate">{fixture.teamA}</span>
              <span className="text-slate-500 text-xs font-bold shrink-0">vs</span>
              <span className="text-white font-semibold text-sm group-hover:text-teal-300 transition-colors truncate">{fixture.teamB}</span>
            </div>
          ) : (
            <p className="text-white font-semibold text-sm group-hover:text-teal-300 transition-colors truncate">{fixture.title}</p>
          )}
          {fixture.location && (
            <p className="flex items-center gap-1 text-slate-500 text-[10px] mt-0.5">
              <MapPin className="h-2.5 w-2.5 shrink-0" /> {fixture.location}
            </p>
          )}
        </div>
        {!isGame && fixture.accessPrice != null && (
          <div className="shrink-0 text-right hidden sm:block">
            <span className="text-amber-400 font-mono font-bold text-xs">${fixture.accessPrice.toFixed(2)}</span>
            <p className="text-slate-600 text-[9px]">access</p>
          </div>
        )}
      </div>
    </Link>
  );
}

function FixturesContent() {
  const { fixtures, sports, isLoading } = useFixtures();
  const [sportFilter, setSportFilter] = useState('all');
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const baseMonday = startOfWeek(now);
  const currentMonday = addDays(baseMonday, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i));

  const filtered = useMemo(() => {
    return fixtures.filter((f) => sportFilter === 'all' || f.sport === sportFilter);
  }, [fixtures, sportFilter]);

  const weekFixtures = useMemo(() => {
    const weekEnd = addDays(currentMonday, 7);
    return filtered.filter((f) => f.date >= currentMonday && f.date < weekEnd);
  }, [filtered, currentMonday]);

  const byDay = useMemo(() => {
    const map = new Map<number, Fixture[]>();
    weekDays.forEach((_, i) => map.set(i, []));
    weekFixtures.forEach((f) => {
      const dayIdx = weekDays.findIndex((d) => sameDay(d, f.date));
      if (dayIdx >= 0) map.get(dayIdx)!.push(f);
    });
    return map;
  }, [weekFixtures, weekDays]);

  const laterFixtures = useMemo(() => {
    const weekEnd = addDays(currentMonday, 7);
    return filtered.filter((f) => f.date >= weekEnd);
  }, [filtered, currentMonday]);

  const laterGrouped = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    laterFixtures.forEach((f) => {
      const key = f.date.toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.entries());
  }, [laterFixtures]);

  const totalWeekFixtures = weekFixtures.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="h-5 w-5 text-teal-400 shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Fixtures</h1>
          {totalWeekFixtures > 0 && (
            <span className="text-xs font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full px-2 py-0.5">
              {totalWeekFixtures} this week
            </span>
          )}
        </div>
        {sports.length > 2 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            {sports.map((s) => {
              const sc = s === 'all' ? null : getSportColor(s);
              const active = sportFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setSportFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all border ${
                    active
                      ? s === 'all'
                        ? 'bg-teal-500 text-slate-950 border-teal-500'
                        : `${sc!.pill} border-current`
                      : 'text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset === 0}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm">{formatWeekRange(currentMonday)}</p>
          {weekOffset === 0 && <p className="text-teal-400 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Current Week</p>}
        </div>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day columns */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => <Skeleton key={d} className="h-20 rounded-xl bg-slate-800" />)}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {weekDays.map((day, i) => {
            const isToday = sameDay(day, now);
            const dayFixtures = byDay.get(i) || [];
            const hasFixtures = dayFixtures.length > 0;
            return (
              <div
                key={i}
                className={`rounded-xl border transition-colors ${
                  isToday ? 'border-teal-500/40 bg-teal-500/5'
                  : hasFixtures ? 'border-slate-700 bg-slate-900/60'
                  : 'border-slate-800/50 bg-slate-900/20'
                }`}
              >
                <div className={`text-center py-2 px-1 border-b ${isToday ? 'border-teal-500/30' : 'border-slate-800/60'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-teal-400' : 'text-slate-500'}`}>{DAYS[i]}</p>
                  <p className={`text-sm font-bold leading-none mt-0.5 ${isToday ? 'text-teal-300' : hasFixtures ? 'text-white' : 'text-slate-600'}`}>
                    {day.getDate()}
                  </p>
                  <p className="text-[9px] text-slate-600 leading-none">{day.toLocaleDateString('en-UG', { month: 'short' })}</p>
                </div>
                <div className="py-2 px-1 flex flex-col items-center gap-1 min-h-[48px] justify-center">
                  {dayFixtures.length === 0 ? (
                    <span className="text-slate-700 text-[10px]">—</span>
                  ) : (
                    dayFixtures.slice(0, 3).map((f) => {
                      const sc = getSportColor(f.sport);
                      return (
                        <Link key={f.key} href={f.href}>
                          <div className={`h-1.5 w-1.5 rounded-full ${sc.dot} hover:scale-125 transition-transform`} title={f.title} />
                        </Link>
                      );
                    })
                  )}
                  {dayFixtures.length > 3 && <span className="text-[9px] text-slate-500">+{dayFixtures.length - 3}</span>}
                  {dayFixtures.length > 0 && (
                    <span className={`text-[10px] font-bold ${isToday ? 'text-teal-400' : 'text-slate-400'}`}>{dayFixtures.length}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* This week list */}
      {!isLoading && weekFixtures.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">This week's fixtures</h2>
          {weekDays.map((day, i) => {
            const dayFixtures = byDay.get(i) || [];
            if (dayFixtures.length === 0) return null;
            const isToday = sameDay(day, now);
            const dayLabel = isToday ? 'Today' : day.toLocaleDateString('en-UG', { weekday: 'long', month: 'short', day: 'numeric' });
            return (
              <div key={i}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className={`text-[11px] font-bold uppercase tracking-widest whitespace-nowrap px-1 ${isToday ? 'text-teal-400' : 'text-slate-500'}`}>
                    {dayLabel}
                  </span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>
                <div className="space-y-2">
                  {dayFixtures.map((f) => <FixtureRow key={f.key} fixture={f} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && weekFixtures.length === 0 && (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 text-slate-700" />
          <p className="text-slate-500 text-sm">No fixtures scheduled for this week.</p>
          {weekOffset === 0 && (
            <button onClick={() => setWeekOffset(1)} className="mt-3 text-teal-400 hover:text-teal-300 text-sm transition-colors">
              Check next week →
            </button>
          )}
        </div>
      )}

      {/* Beyond this week */}
      {!isLoading && laterGrouped.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600 whitespace-nowrap px-1">Beyond this week</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          {laterGrouped.map(([label, items]) => (
            <div key={label}>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 pl-1">{label}</p>
              <div className="space-y-2">
                {items.map((f) => <FixtureRow key={f.key} fixture={f} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Fixtures() {
  useSEO({
    title: 'Fixtures & Schedule',
    path: '/fixtures',
    description: 'Full fixture schedule for Pool and Boxing matches on ATA Sports Live. Filter by sport, date, and location. Never miss a match across Africa.',
    jsonLd: makeBreadcrumb([
      { name: 'Home', url: SITE_URL },
      { name: 'Fixtures', url: `${SITE_URL}/fixtures` },
    ]),
  });

  const adSlots = useAdSlots();

  return (
    <div className="relative">
      {/* Desktop 3-column layout */}
      <div className="hidden lg:flex items-start gap-4 xl:gap-6">
        {/* Left ads */}
        <aside className="w-40 xl:w-44 shrink-0 sticky top-8 space-y-3">
          <AdCard slotKey="left_1" slot={adSlots.left_1} />
          <AdCard slotKey="left_2" slot={adSlots.left_2} />
          <AdCard slotKey="left_3" slot={adSlots.left_3} />
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <FixturesContent />
        </div>

        {/* Right ads */}
        <aside className="w-40 xl:w-44 shrink-0 sticky top-8 space-y-3">
          <AdCard slotKey="right_1" slot={adSlots.right_1} />
          <AdCard slotKey="right_2" slot={adSlots.right_2} />
          <AdCard slotKey="right_3" slot={adSlots.right_3} />
        </aside>
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden">
        {/* Mobile top ads */}
        <div className="space-y-2 mb-5">
          <HorizontalAdBanner slotKey="left_1" slot={adSlots.left_1} />
          <HorizontalAdBanner slotKey="right_1" slot={adSlots.right_1} />
        </div>

        <FixturesContent />

        {/* Mobile bottom ads */}
        <div className="space-y-2 mt-5">
          <HorizontalAdBanner slotKey="left_2" slot={adSlots.left_2} />
          <HorizontalAdBanner slotKey="left_3" slot={adSlots.left_3} />
          <HorizontalAdBanner slotKey="right_2" slot={adSlots.right_2} />
          <HorizontalAdBanner slotKey="right_3" slot={adSlots.right_3} />
        </div>
      </div>
    </div>
  );
}
