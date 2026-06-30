import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useListStreams, useCheckStreamAccess } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, LockOpen, Eye, Play, Radio, Film, Trophy, Users, TrendingUp, Flame } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSEO, makeBreadcrumb, SITE_URL } from '@/lib/seo';

interface Stream {
  id: number;
  title: string;
  sport: string;
  status: string;
  accessPrice?: number | null;
  thumbnailUrl?: string | null;
  startTime: string;
  viewerCount?: number | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
}

const SPORT_GRADIENT: Record<string, string> = {
  pool:       'from-teal-900 via-teal-950 to-slate-950',
  boxing:     'from-red-900 via-red-950 to-slate-950',
  football:   'from-emerald-900 via-emerald-950 to-slate-950',
  athletics:  'from-orange-900 via-orange-950 to-slate-950',
  basketball: 'from-amber-900 via-amber-950 to-slate-950',
  tournament: 'from-violet-900 via-violet-950 to-slate-950',
};

const SPORT_COLOR: Record<string, string> = {
  pool:       'text-teal-400 bg-teal-500/10 border-teal-500/30',
  boxing:     'text-red-400 bg-red-500/10 border-red-500/30',
  football:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  athletics:  'text-orange-400 bg-orange-500/10 border-orange-500/30',
  basketball: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  tournament: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
};

function StreamCard({ stream, isAuthenticated }: { stream: Stream; isAuthenticated: boolean }) {
  const isPaid = !!stream.accessPrice && stream.accessPrice > 0;
  const isEnded = stream.status === 'ended';
  const isLive = stream.status === 'live';

  const { data: accessData } = useCheckStreamAccess(stream.id, {
    query: { enabled: !!isAuthenticated && !!isPaid && !isEnded, queryKey: ['stream-access', stream.id] },
  });
  const hasAccess = accessData?.hasAccess === true;

  const gradient = SPORT_GRADIENT[stream.sport] ?? 'from-slate-800 via-slate-900 to-slate-950';
  const sportPill = SPORT_COLOR[stream.sport] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30';

  return (
    <Link href={isLive ? '/live' : `/streams/${stream.id}`}>
      <div className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer
        ${isLive
          ? 'border-red-500/40 shadow-lg shadow-red-500/10 hover:border-red-400/60'
          : 'border-slate-800 hover:border-teal-500/40'
        }`}
      >
        {/* Cover image / placeholder */}
        <div className="relative aspect-video overflow-hidden bg-slate-900">
          {stream.thumbnailUrl ? (
            <img
              src={stream.thumbnailUrl}
              alt={stream.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <Film className="h-10 w-10 text-white/10" />
              <img
                src="/ata-logo.png"
                alt=""
                aria-hidden
                className="absolute inset-0 m-auto h-14 w-14 object-contain opacity-[0.07] select-none pointer-events-none"
              />
            </div>
          )}

          {/* Dark gradient overlay at the bottom for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />

          {/* Top-left: sport badge */}
          <div className="absolute top-2.5 left-2.5">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${sportPill}`}>
              {stream.sport}
            </span>
          </div>

          {/* Top-right: status badge */}
          <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-red-500/40">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
            {stream.status === 'upcoming' && (
              <span className="rounded bg-slate-900/80 border border-teal-500/40 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-teal-400">
                SOON
              </span>
            )}
            {isEnded && (
              <span className="rounded bg-slate-900/80 border border-slate-700/60 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                ENDED
              </span>
            )}
          </div>

          {/* Bottom-right: play icon overlay on hover */}
          {!isEnded && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                <Play className="h-5 w-5 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}

          {/* Bottom-left: viewer count if live */}
          {isLive && (stream.viewerCount ?? 0) > 0 && (
            <div className="absolute bottom-2 left-2.5">
              <span className="flex items-center gap-1 text-[10px] text-white/70 font-mono">
                <Eye className="h-2.5 w-2.5" /> {stream.viewerCount}
              </span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-col gap-1.5 p-3 bg-slate-900/90">
          <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-teal-300 transition-colors">
            {stream.title}
          </h3>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 font-mono">
              {new Date(stream.startTime).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>

            {/* Access badge */}
            {isPaid && !isEnded ? (
              hasAccess ? (
                <span className="flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  <LockOpen className="h-2.5 w-2.5" /> Access
                </span>
              ) : (
                <span className="flex items-center gap-0.5 rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  <Lock className="h-2.5 w-2.5" /> ${stream.accessPrice!.toFixed(2)}/day
                </span>
              )
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Live Viewer Leaderboard ──────────────────────────────────────────────────

const RANK_STYLES = [
  { medal: '🥇', bar: 'bg-amber-400', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  { medal: '🥈', bar: 'bg-slate-400', text: 'text-slate-300', border: 'border-slate-500/30', bg: 'bg-slate-800/40' },
  { medal: '🥉', bar: 'bg-orange-600', text: 'text-orange-400', border: 'border-orange-700/30', bg: 'bg-orange-900/10' },
];

function LiveLeaderboard({ streams }: { streams: Stream[] }) {
  const live = [...streams]
    .filter((s) => s.status === 'live')
    .sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));

  if (live.length === 0) return null;

  const topViewer = live[0].viewerCount ?? 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20">
            <Flame className="h-3.5 w-3.5 text-red-400" />
          </div>
          <span className="text-sm font-semibold text-white">Live Now</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            {live.length} stream{live.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <TrendingUp className="h-3 w-3" />
          Ranked by viewers
        </div>
      </div>

      {/* Ranked rows */}
      <div className="divide-y divide-slate-800/60">
        {live.map((stream, i) => {
          const style = RANK_STYLES[i] ?? {
            medal: `#${i + 1}`,
            bar: 'bg-slate-700',
            text: 'text-slate-400',
            border: 'border-slate-800',
            bg: '',
          };
          const viewers = stream.viewerCount ?? 0;
          const barPct = topViewer > 0 ? Math.max(4, Math.round((viewers / topViewer) * 100)) : 4;
          const sportPill = SPORT_COLOR[stream.sport] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30';

          return (
            <Link key={stream.id} href="/live">
              <div className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer ${style.bg}`}>
                {/* Rank */}
                <div className="w-7 shrink-0 text-center text-base leading-none select-none">{style.medal}</div>

                {/* Thumbnail */}
                <div className="h-10 w-16 shrink-0 rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                  {stream.thumbnailUrl ? (
                    <img src={stream.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${SPORT_GRADIENT[stream.sport] ?? 'from-slate-800 to-slate-900'}`}>
                      <Film className="h-4 w-4 text-white/20" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`shrink-0 inline-flex items-center rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wider ${sportPill}`}>
                      {stream.sport}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate group-hover:text-teal-300 transition-colors">
                    {stream.title}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all duration-700`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>

                {/* Viewer count */}
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <div className={`flex items-center gap-1 font-mono font-bold text-sm ${style.text}`}>
                    <Users className="h-3 w-3" />
                    {viewers.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-600">watching</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StreamCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <Skeleton className="aspect-video w-full bg-slate-800" />
      <div className="p-3 space-y-2 bg-slate-900/90">
        <Skeleton className="h-4 w-3/4 bg-slate-800" />
        <Skeleton className="h-3 w-1/2 bg-slate-800" />
      </div>
    </div>
  );
}

export default function Streams() {
  const [status, setStatus] = useState<string>('all');
  const { isAuthenticated } = useAuth();

  useSEO({
    title: 'Live Streams',
    path: '/streams',
    description: 'Browse live and upcoming Pool and Boxing streams from across Africa. Watch in HD for $1.50/day — no subscription, pay per stream.',
    jsonLd: makeBreadcrumb([
      { name: 'Home', url: SITE_URL },
      { name: 'Live Streams', url: `${SITE_URL}/streams` },
    ]),
  });

  const { data: streamsData, isLoading } = useListStreams(
    { status: status !== 'all' ? status : undefined, limit: 40 },
    { query: { refetchInterval: 30_000 } },
  );

  const streams = (streamsData?.streams || []) as Stream[];
  const liveCount = streams.filter((s) => s.status === 'live').length;

  return (
    <div className="space-y-6">
      {/* Live leaderboard — only shown when there are live streams */}
      {!isLoading && <LiveLeaderboard streams={streams} />}

      {/* Filter */}
      <div className="flex justify-end">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 text-white text-sm h-8">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white">
            <SelectItem value="all">All Streams</SelectItem>
            <SelectItem value="live">Live Now</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {isLoading
          ? Array(10).fill(0).map((_, i) => <StreamCardSkeleton key={i} />)
          : streams.length
          ? streams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isAuthenticated={isAuthenticated}
              />
            ))
          : (
            <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-sm">
              <Film className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No streams found.
            </div>
          )}
      </div>
    </div>
  );
}
