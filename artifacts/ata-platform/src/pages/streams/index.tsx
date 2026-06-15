import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useListStreams, usePurchaseStreamAccess, useCheckStreamAccess } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Lock, LockOpen, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

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

interface StreamCardProps {
  stream: Stream;
  isAuthenticated: boolean;
  onPaywallRequest: (stream: Stream) => void;
}

function StreamCard({ stream, isAuthenticated, onPaywallRequest }: StreamCardProps) {
  const [, navigate] = useLocation();
  const isPaid = stream.accessPrice && stream.accessPrice > 0;
  const isEnded = stream.status === 'ended';

  const { data: accessData } = useCheckStreamAccess(stream.id, {
    query: { enabled: !!isAuthenticated && !!isPaid && !isEnded },
  });
  const hasAccess = accessData?.hasAccess === true;

  const isLive = stream.status === 'live';

  const handleClick = () => {
    if (isPaid && !isEnded && isLive) {
      if (!isAuthenticated) { navigate('/login'); return; }
      if (hasAccess) { navigate(`/streams/${stream.id}`); }
      else { onPaywallRequest(stream); }
    } else {
      navigate(`/streams/${stream.id}`);
    }
  };

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
      onClick={handleClick}
      className="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80 hover:border-teal-500/40 hover:bg-slate-900 transition-all duration-200 cursor-pointer"
    >
      {/* Faded ATA watermark */}
      <img
        src="/ata-logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-2 h-16 w-16 object-contain opacity-[0.045] select-none"
      />

      <div className="relative p-3 flex flex-col gap-2">
        {/* Top row: sport badge + status + lock */}
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
            {/* Lock / access */}
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

        {/* Title */}
        <h3 className="font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-teal-300 transition-colors pr-10">
          {stream.title}
        </h3>

        {/* Bottom row: date + viewers */}
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
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [pendingStream, setPendingStream] = useState<Stream | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const purchaseMutation = usePurchaseStreamAccess();

  useEffect(() => { document.title = 'Streams - ATA Platform'; }, []);

  const { data: streamsData, isLoading } = useListStreams({
    status: status !== 'all' ? status : undefined,
    limit: 20,
  });

  const handleConfirm = async () => {
    if (!pendingStream) return;
    setPurchasing(true);
    try {
      await purchaseMutation.mutateAsync({ id: pendingStream.id });
      toast.success('Access granted! Enjoy the stream.');
      setPendingStream(null);
      navigate(`/streams/${pendingStream.id}`);
    } catch (e: any) {
      const msg: string = e?.data?.error || e?.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('active')) {
        setPendingStream(null);
        navigate(`/streams/${pendingStream.id}`);
      } else {
        toast.error(msg || 'Purchase failed — check your wallet balance');
      }
    } finally {
      setPurchasing(false);
    }
  };

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
                onPaywallRequest={setPendingStream}
              />
            ))
          : (
            <div className="col-span-full py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-sm">
              No streams found.
            </div>
          )}
      </div>

      <Dialog open={!!pendingStream} onOpenChange={(open) => { if (!open) setPendingStream(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Lock className="h-4 w-4 text-amber-400" /> Premium Stream
            </DialogTitle>
            <DialogDescription className="text-slate-400 pt-1 text-sm">
              <span className="font-semibold text-white">{pendingStream?.title}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-1 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 text-sm">Access fee</span>
              <span className="text-amber-400 font-bold text-xl">
                ${pendingStream?.accessPrice?.toFixed(2) ?? '1.50'}
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              ${pendingStream?.accessPrice?.toFixed(2) ?? '1.50'} deducted from your wallet · 24-hour access
            </p>
          </div>
          <DialogFooter className="flex gap-2 mt-1">
            <Button variant="ghost" onClick={() => setPendingStream(null)} disabled={purchasing} className="text-slate-400 hover:text-white flex-1 h-9">
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={purchasing} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex-1 h-9">
              {purchasing ? 'Processing…' : `Pay $${pendingStream?.accessPrice?.toFixed(2) ?? '1.50'} & Watch`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
