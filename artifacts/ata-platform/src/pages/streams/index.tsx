import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useListStreams, usePurchaseStreamAccess } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Lock, Unlock } from 'lucide-react';
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

export default function Streams() {
  const [status, setStatus] = useState<string>('all');
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [pendingStream, setPendingStream] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);

  const purchaseMutation = usePurchaseStreamAccess();

  useEffect(() => {
    document.title = 'Streams - ATA Platform';
  }, []);

  const { data: streamsData, isLoading } = useListStreams({
    status: status !== 'all' ? status : undefined,
    limit: 20,
  });

  const handleCardClick = (e: React.MouseEvent, stream: any) => {
    e.preventDefault();
    if (stream.accessPrice && stream.accessPrice > 0 && stream.status !== 'ended') {
      if (!isAuthenticated) {
        navigate('/login');
        return;
      }
      setPendingStream(stream);
    } else {
      navigate(`/streams/${stream.id}`);
    }
  };

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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Live Streams</h1>
          <p className="text-slate-400 mt-1">Watch premium African sports action</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 text-white">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl bg-slate-800" />
          ))
        ) : streamsData?.streams.length ? (
          streamsData.streams.map((stream) => {
            const isPaid = stream.accessPrice && stream.accessPrice > 0;
            const isEnded = stream.status === 'ended';

            return (
              <div
                key={stream.id}
                className="group overflow-hidden rounded-xl border border-primary/20 bg-card hover:border-teal-500/50 transition-all duration-300 cursor-pointer flex flex-col"
                onClick={(e) => handleCardClick(e, stream)}
              >
                <div className="relative aspect-video bg-slate-900">
                  {stream.thumbnailUrl ? (
                    <img
                      src={stream.thumbnailUrl}
                      alt={stream.title}
                      className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <Play className="h-12 w-12 text-slate-600" />
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    {stream.status === 'live' ? (
                      <span className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                        LIVE
                      </span>
                    ) : stream.status === 'upcoming' ? (
                      <span className="inline-flex items-center rounded-md bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-400 ring-1 ring-inset ring-teal-500/20">
                        UPCOMING
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">
                        ENDED
                      </span>
                    )}
                  </div>

                  {/* Lock / access icon */}
                  {isPaid && !isEnded && (
                    <div className="absolute top-3 right-3 bg-slate-950/80 rounded-full p-1.5 backdrop-blur-sm border border-slate-700/60">
                      <Lock className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                  )}
                  {isEnded && (
                    <div className="absolute top-3 right-3 bg-slate-950/80 rounded-full p-1.5 backdrop-blur-sm border border-slate-700/60">
                      <Unlock className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                  )}
                </div>

                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 capitalize">
                        {stream.sport}
                      </span>
                      {isPaid ? (
                        <span className="text-sm font-medium text-amber-400 flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          ${stream.accessPrice!.toFixed(2)}/day
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-teal-400">FREE</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-white group-hover:text-teal-300 transition-colors line-clamp-2">
                      {stream.title}
                    </h3>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
                    <span>{new Date(stream.startTime).toLocaleDateString()}</span>
                    <span>{stream.viewerCount || 0} viewers</span>
                  </div>
                </CardContent>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No streams found matching the criteria.
          </div>
        )}
      </div>

      {/* Paywall confirmation dialog */}
      <Dialog open={!!pendingStream} onOpenChange={(open) => { if (!open) setPendingStream(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-amber-400" /> Paid Stream
            </DialogTitle>
            <DialogDescription className="text-slate-400 pt-1">
              <span className="font-semibold text-white">{pendingStream?.title}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 my-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 text-sm">Access fee</span>
              <span className="text-amber-400 font-bold text-lg">
                ${pendingStream?.accessPrice?.toFixed(2) ?? '1.50'}
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              ${pendingStream?.accessPrice?.toFixed(2) ?? '1.50'} will be deducted from your wallet balance. You get 24-hour access to this stream.
            </p>
          </div>

          <DialogFooter className="flex gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={() => setPendingStream(null)}
              disabled={purchasing}
              className="text-slate-400 hover:text-white flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={purchasing}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex-1"
            >
              {purchasing ? 'Processing…' : `Pay & Watch`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
