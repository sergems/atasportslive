import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useListStreams, useCheckStreamAccess } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, LockOpen, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Stream {
  id: number;
  title: string;
  sport: string;
  status: string;
  accessPrice?: number | null;
  thumbnailUrl?: string | null;
  startTime: string;
  viewerCount?: number | null;
}

function StreamCard({ stream, isAuthenticated }: { stream: Stream; isAuthenticated: boolean }) {
  const [, navigate] = useLocation();
  const isPaid = stream.accessPrice && stream.accessPrice > 0;
  const isEnded = stream.status === 'ended';

  const { data: accessData } = useCheckStreamAccess(stream.id, {
    query: { enabled: !!isAuthenticated && !!isPaid && !isEnded },
  });
  const hasAccess = accessData?.hasAccess === true;

  const sportColor: Record<string, string> = {
    pool: 'text-teal-400',
    boxing: 'text-red-400',
    football: 'text-emerald-400',
    athletics: 'text-orange-400',
    basketball: 'text-amber-400',
  };
  const sportBg: Record<string, string> = {
    pool: 'bg-teal-500/10 border-teal-500/20',
    boxing: 'bg-red-500/10 border-red-500/20',
    football: 'bg-emerald-500/10 border-emerald-500/20',
    athletics: 'bg-orange-500/10 border-orange-500/20',
    basketball: 'bg-amber-500/10 border-amber-500/20',
  };
  const sc = sportColor[stream.sport] ?? 'text-slate-400';
  const sb = sportBg[stream.sport] ?? 'bg-slate-500/10 border-slate-500/20';

  return (
    <div
      onClick={() => navigate('/live')}
      className="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 hover:border-teal-500/40 hover:bg-slate-900 transition-all duration-200 cursor-pointer"
    >
      <img
        src="/ata-logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-2 h-16 w-16 object-contain opacity-[0.045] select-none"
      />

      <div className="relative p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc} ${sb}`}>
            {stream.sport}
          </span>
          <div className="flex items-center gap-1.5">
            {stream.status === 'live' && (
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            )}
            {stream.status === 'upcoming' && (
              <span className="rounded bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-400">
                SOON
              </span>
            )}
            {stream.status === 'ended' && (
              <span className="rounded bg-slate-700/40 border border-slate-700/60 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                ENDED
              </span>
            )}
            {isPaid && !isEnded ? (
              hasAccess ? (
                <span className="flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  <LockOpen className="h-2.5 w-2.5" /> OPEN
                </span>
              ) : (
                <span className="flex items-center gap-0.5 rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  <Lock className="h-2.5 w-2.5" /> ${stream.accessPrice!.toFixed(2)}
                </span>
              )
            ) : null}
          </div>
        </div>

        <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-teal-300 transition-colors pr-10">
          {stream.title}
        </h3>

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/80">
          <span>{new Date(stream.startTime).toLocaleDateString()}</span>
          <span className="flex items-center gap-1">
            <Eye className="h-2.5 w-2.5" />
            {stream.viewerCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Streams() {
  const [status, setStatus] = useState<string>('all');
  const { isAuthenticated } = useAuth();

  useEffect(() => { document.title = 'Streams - ATA Platform'; }, []);

  const { data: streamsData, isLoading } = useListStreams({
    status: status !== 'all' ? status : undefined,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Live Streams</h1>
          <p className="text-slate-400 text-sm mt-0.5">Watch premium African sports action</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] bg-slate-900 border-slate-800 text-white text-sm h-8">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white">
            <SelectItem value="all">All Streams</SelectItem>
            <SelectItem value="live">Live Now</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {isLoading
          ? Array(10).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg bg-slate-800" />
            ))
          : streamsData?.streams.length
          ? streamsData.streams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream as Stream}
                isAuthenticated={isAuthenticated}
              />
            ))
          : (
            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-sm">
              No streams found.
            </div>
          )}
      </div>
    </div>
  );
}
