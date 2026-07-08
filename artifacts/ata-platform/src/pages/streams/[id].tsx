import React, { useEffect, useRef, useState } from 'react';
import { useRoute } from 'wouter';
import { Link } from 'wouter';
import { useGetStream, useCheckStreamAccess, usePurchaseStreamAccess, StreamStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Play, Users, ChevronLeft, Clock, CalendarClock } from 'lucide-react';
import Hls from 'hls.js';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useSEO, makeVideoObject, makeBreadcrumb, SITE_URL } from '@/lib/seo';

export default function StreamDetail() {
  const [, params] = useRoute('/streams/:id');
  const streamId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: stream, isLoading: loadingStream } = useGetStream(streamId);
  const { data: access, isLoading: loadingAccess, refetch: refetchAccess } = useCheckStreamAccess(streamId);
  const purchaseMutation = usePurchaseStreamAccess();
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dynamic SEO — updates as stream data loads. Called unconditionally (hook rules).
  useSEO({
    title: stream?.title ?? 'Stream',
    description: stream
      ? `Watch ${stream.title} live on ATA Sports Live — Africa's premier ${stream.sport ?? 'sports'} streaming platform. Stream from $1.50/day.`
      : "Watch live sports streams on ATA Sports Live — Africa's premier streaming platform.",
    path: `/streams/${streamId}`,
    ogImage: stream?.thumbnailUrl ?? undefined,
    ogType: 'video.other',
    jsonLd: stream
      ? [
          makeVideoObject({
            name: stream.title,
            description:
              stream.description ||
              `Live ${stream.sport ?? 'sports'} stream on ATA Sports Live.`,
            thumbnailUrl: stream.thumbnailUrl ?? undefined,
            url: `${SITE_URL}/streams/${streamId}`,
          }),
          makeBreadcrumb([
            { name: 'Home', url: SITE_URL },
            { name: 'Streams', url: `${SITE_URL}/streams` },
            { name: stream.title, url: `${SITE_URL}/streams/${streamId}` },
          ]),
        ]
      : undefined,
  });

  useEffect(() => {
    if (stream?.status === 'live' && access?.hasAccess && stream.hlsUrl && videoRef.current) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(stream.hlsUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => { /* autoplay blocked by browser — user can press play */ });
        });
        return () => hls.destroy();
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = stream.hlsUrl;
        videoRef.current.play().catch(() => { /* autoplay blocked by browser — user can press play */ });
      }
    }
    return undefined;
  }, [stream, access]);

  const handlePurchase = () => {
    purchaseMutation.mutate({ id: streamId }, {
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
      {/* Back nav */}
      <Link href="/streams">
        <button className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Streams
        </button>
      </Link>

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
             {stream.thumbnailUrl && <img src={stream.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
             <div className="z-10 text-center px-6 max-w-md">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-5">
                 <CalendarClock className="h-8 w-8 text-amber-400" />
               </div>
               <h3 className="text-2xl font-bold text-white mb-2">Not Broadcasting Yet</h3>
               <p className="text-slate-400 text-sm mb-5">
                 This event is scheduled and will go live on:
               </p>
               <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-6 py-4 inline-block mb-5">
                 <div className="text-amber-400 font-bold text-xl">
                   {new Date(stream.startTime).toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                 </div>
                 <div className="text-white font-mono text-2xl mt-1">
                   {new Date(stream.startTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                 </div>
               </div>
               <p className="text-slate-500 text-xs flex items-center justify-center gap-1.5">
                 <Clock className="h-3.5 w-3.5" />
                 Come back when the event is live to purchase access
               </p>
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
          {isAdmin && (
            <div className="flex flex-col items-end">
              <span className="uppercase text-[10px] font-bold tracking-wider text-slate-500">Viewers</span>
              <span className="font-mono text-lg text-white flex items-center"><Users className="h-4 w-4 mr-2 text-teal-500" /> {stream.viewerCount || 0}</span>
            </div>
          )}
          <div className="flex flex-col items-end">
             <span className="uppercase text-[10px] font-bold tracking-wider text-slate-500">Access</span>
             <span className="font-mono text-lg text-amber-400">{stream.accessPrice ? `$${stream.accessPrice.toFixed(2)}` : 'FREE'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
