import React, { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { useGetStream, useCheckStreamAccess, usePurchaseStreamAccess, StreamStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Countdown } from '@/components/ui/countdown';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Play, Users } from 'lucide-react';
import Hls from 'hls.js';
import { toast } from 'sonner';

export default function StreamDetail() {
  const [, params] = useRoute('/streams/:id');
  const streamId = params?.id ? parseInt(params.id) : 0;

  const { data: stream, isLoading: loadingStream } = useGetStream(streamId);
  const { data: access, isLoading: loadingAccess, refetch: refetchAccess } = useCheckStreamAccess(streamId);
  const purchaseMutation = usePurchaseStreamAccess();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (stream) {
      document.title = `${stream.title} - ATA Streams`;
    }
  }, [stream]);

  useEffect(() => {
    if (stream?.status === 'live' && access?.hasAccess && stream.hlsUrl && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(stream.hlsUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(e => console.error("Playback failed", e));
        });
        return () => hls.destroy();
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = stream.hlsUrl;
        videoRef.current.play().catch(e => console.error("Playback failed", e));
      }
    }
  }, [stream, access]);

  const handlePurchase = () => {
    purchaseMutation.mutate({ data: { streamId } }, {
      onSuccess: () => {
        toast.success("Access purchased successfully!");
        refetchAccess();
      },
      onError: (err: any) => {
        toast.error("Purchase failed", { description: err?.message || "Insufficient balance" });
      }
    });
  };

  if (loadingStream || loadingAccess) {
    return <div className="space-y-4"><Skeleton className="w-full aspect-video rounded-xl bg-slate-800" /><Skeleton className="h-10 w-1/3 bg-slate-800" /></div>;
  }

  if (!stream) {
    return <div className="text-center py-20 text-slate-500">Stream not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        {stream.status === 'live' ? (
          access?.hasAccess ? (
            <video ref={videoRef} className="w-full h-full object-cover" controls playsInline />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur">
              <Lock className="h-12 w-12 text-slate-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Premium Access Required</h3>
              <p className="text-slate-400 mb-6 text-center max-w-md">Purchase access to watch this live stream.</p>
              <Button onClick={handlePurchase} disabled={purchaseMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8">
                {purchaseMutation.isPending ? "Processing..." : `Pay $${stream.accessPrice?.toFixed(2) || '0.00'}`}
              </Button>
            </div>
          )
        ) : stream.status === 'upcoming' ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
             {stream.thumbnailUrl && <img src={stream.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
             <div className="z-10 text-center">
               <h3 className="text-2xl font-bold text-white mb-4">Starts In</h3>
               <div className="text-5xl font-mono font-bold text-amber-500">
                 {/* Simplified countdown for this view */}
                 <Countdown seconds={3600} /> {/* Assuming we'd get this from backend, hardcoded for now just as placeholder if missing field */}
               </div>
             </div>
           </div>
        ) : (
           <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
             <div className="text-xl font-bold text-slate-500 uppercase tracking-widest">Stream Ended</div>
           </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stream.sport}</span>
             {stream.status === 'live' && <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 ring-1 ring-inset ring-red-500/20 animate-pulse">LIVE</span>}
          </div>
          <h1 className="text-3xl font-bold text-white">{stream.title}</h1>
          <p className="text-slate-400 mt-2 max-w-3xl">{stream.description}</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <div className="flex flex-col items-end">
            <span className="uppercase text-[10px] font-bold tracking-wider text-slate-500">Viewers</span>
            <span className="font-mono text-lg text-white flex items-center"><Users className="h-4 w-4 mr-2 text-teal-500" /> {stream.viewerCount || 0}</span>
          </div>
          <div className="flex flex-col items-end">
             <span className="uppercase text-[10px] font-bold tracking-wider text-slate-500">Access</span>
             <span className="font-mono text-lg text-amber-400">{stream.accessPrice ? `$${stream.accessPrice.toFixed(2)}` : 'FREE'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
