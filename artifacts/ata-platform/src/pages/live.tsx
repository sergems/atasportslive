import React, { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lock, Radio, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { useAuthStore } from '@/lib/auth-store';

interface Stream {
  id: number;
  title: string;
  description: string | null;
  sport: string;
  hlsUrl: string | null;
  status: string;
  startTime: string;
  viewerCount: number | null;
  accessPrice: number;
  thumbnailUrl: string | null;
  city: string | null;
  country: string | null;
}

interface AccessStatus {
  hasAccess: boolean;
  expiresAt: string | null;
  secondsRemaining: number | null;
}

interface UpcomingStream {
  id: number;
  title: string;
  sport: string;
  startTime: string;
  secondsUntilStart: number;
}

function useLiveStream() {
  return useQuery<Stream | null>({
    queryKey: ['streams', 'live', 'current'],
    queryFn: async () => {
      const r = await fetch('/api/streams?status=live&limit=1');
      const data = await r.json();
      return data.streams?.[0] ?? null;
    },
    refetchInterval: 30000,
  });
}

function useGlobalSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    refetchInterval: 60000,
  });
}

function useStreamAccess(streamId: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery<AccessStatus>({
    queryKey: ['streams', streamId, 'access'],
    queryFn: async () => {
      const r = await fetch(`/api/streams/${streamId}/access/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    enabled: !!streamId && !!token,
    refetchInterval: 60000,
  });
}

function useNextUpcoming() {
  return useQuery<UpcomingStream[]>({
    queryKey: ['streams', 'upcoming'],
    queryFn: () => fetch('/api/streams/upcoming').then((r) => r.json()),
  });
}

function HlsPlayer({ hlsUrl, title }: { hlsUrl: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(() => {});
      });
      return () => hls.destroy();
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = hlsUrl;
      videoRef.current.play().catch(() => {});
    }
  }, [hlsUrl]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      controls
      playsInline
      title={title}
    />
  );
}

function NoLiveBroadcast() {
  const { data: upcoming } = useNextUpcoming();
  const next = upcoming?.[0];

  return (
    <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl border border-slate-800 text-center px-6 py-10 w-full">
      <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 border border-slate-700 mb-4 sm:mb-6">
        <Radio className="h-7 w-7 sm:h-9 sm:w-9 text-slate-600" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">No Live Broadcast</h2>
      <p className="text-slate-400 text-sm mb-5 max-w-md">
        There is no live event right now. Check the schedule below or come back when the next event starts.
      </p>
      {next && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-5 py-3 inline-block mb-4">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Next up</p>
          <p className="text-white font-semibold text-sm sm:text-base">{next.title}</p>
          <p className="text-amber-400 font-mono text-sm mt-1">
            {new Date(next.startTime).toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(next.startTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
      <Link href="/upcoming" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
        View full schedule →
      </Link>
    </div>
  );
}

export default function Live() {
  useEffect(() => { document.title = 'Live - ATA Platform'; }, []);

  const { isAuthenticated } = useAuth();
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  const { data: stream, isLoading: loadingStream } = useLiveStream();
  const { data: settings, isLoading: loadingSettings } = useGlobalSettings();
  const { data: access, isLoading: loadingAccess } = useStreamAccess(stream?.id);

  const liveStreamUrl = settings?.liveStreamUrl ?? '';

  const purchaseMutation = useMutation({
    mutationFn: async (streamId: number) => {
      const r = await fetch(`/api/streams/${streamId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ streamId }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Purchase failed'); }
      return r.json();
    },
    onSuccess: () => {
      toast.success('Access granted! Enjoy the live broadcast.');
      qc.invalidateQueries({ queryKey: ['streams', stream?.id, 'access'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => {
      toast.error(e.message || 'Purchase failed — check your wallet balance');
    },
  });

  const isLoading = loadingStream || loadingSettings || (!!stream && isAuthenticated && loadingAccess);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      {/* Player / placeholder area */}
      {isLoading ? (
        <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
          <Skeleton className="w-full h-full bg-slate-800" />
        </div>
      ) : !stream || !liveStreamUrl ? (
        /* No broadcast — render outside aspect-video so content is never clipped */
        <NoLiveBroadcast />
      ) : access?.hasAccess ? (
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl w-full">
          <HlsPlayer hlsUrl={liveStreamUrl} title={stream.title} />
        </div>
      ) : (
        /* Paywall */
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl w-full">
          {stream.thumbnailUrl && (
            <img src={stream.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur">
            <div className="relative z-10 text-center px-6 max-w-md">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-3 sm:mb-5">
                <Lock className="h-5 w-5 sm:h-7 sm:w-7 text-amber-400" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">Premium Access Required</h3>
              <p className="text-slate-400 text-sm mb-1">{stream.title}</p>
              <p className="text-slate-500 text-xs mb-4 sm:mb-6">Unlock this broadcast for 24 hours</p>

              {!isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-slate-400 text-sm">Sign in to purchase access</p>
                  <Link href="/login">
                    <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8">
                      Sign In to Watch
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 sm:px-6 sm:py-4 inline-block">
                    <p className="text-slate-400 text-xs mb-1">Access fee</p>
                    <p className="text-amber-400 font-bold text-2xl sm:text-3xl font-mono">
                      ${stream.accessPrice.toFixed(2)}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">deducted from your wallet</p>
                  </div>
                  <div>
                    <Button
                      onClick={() => purchaseMutation.mutate(stream.id)}
                      disabled={purchaseMutation.isPending}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 sm:px-10 h-10 sm:h-11 text-sm sm:text-base"
                    >
                      {purchaseMutation.isPending ? 'Processing…' : `Pay $${stream.accessPrice.toFixed(2)} & Watch`}
                    </Button>
                    <p className="text-slate-600 text-xs mt-2 flex items-center justify-center gap-1">
                      <Wallet className="h-3 w-3" /> Charged from your ATA wallet
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stream info bar */}
      {stream && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{stream.sport}</span>
              {(stream.city || stream.country) && (
                <span className="text-xs text-slate-600">
                  · {[stream.city, stream.country].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white">{stream.title}</h1>
            {stream.description && (
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">{stream.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-sm shrink-0">
            <Users className="h-4 w-4 text-teal-500" />
            <span className="font-mono text-white">{stream.viewerCount ?? 0}</span>
            <span className="text-slate-500">watching</span>
          </div>
        </div>
      )}
    </div>
  );
}
