import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lock, Radio, Users, Wallet, ArrowUpCircle, AlertTriangle } from 'lucide-react';
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

const FALLBACK_MUX_PLAYBACK_ID = 'QEQX7ir02QjD1eYSV00vdTr8waLZof6bisQLNWzom00sZ00';

function MuxPlayer({ playbackId, title }: { playbackId: string; title: string }) {
  return (
    <div className="relative w-full h-full">
      <iframe
        src={`https://player.mux.com/${playbackId}`}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

function HlsPlayer({ hlsUrl, title }: { hlsUrl: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(() => {});
    }
    return undefined;
  }, [hlsUrl]);

  // Auto-fullscreen when phone rotates to landscape
  useEffect(() => {
    const handleOrientationChange = () => {
      const video = videoRef.current;
      if (!video) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        if (video.requestFullscreen) {
          video.requestFullscreen().catch(() => {});
        } else if ((video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
      } else {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    };

    const orientationApi = window.screen?.orientation;
    if (orientationApi) {
      orientationApi.addEventListener('change', handleOrientationChange);
    } else {
      window.addEventListener('orientationchange', handleOrientationChange);
    }
    return () => {
      if (orientationApi) {
        orientationApi.removeEventListener('change', handleOrientationChange);
      } else {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, []);

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

  // Derive Mux settings
  const liveStreamUrl  = settings?.liveStreamUrl ?? '';
  const muxPlaybackId  = settings?.mux_playback_id || FALLBACK_MUX_PLAYBACK_ID;
  const muxIsLive      = settings?.mux_is_live === 'true';
  const muxIsFree      = settings?.mux_is_free === 'true';
  const muxPrice       = parseFloat(settings?.mux_price ?? '1.50');
  const muxTitle       = settings?.mux_title || 'ATA Live Stream';
  const muxStreamDbId  = settings?.mux_stream_db_id ? Number(settings.mux_stream_db_id) : undefined;

  // Which stream drives the paywall?
  // Priority: DB live stream > Mux live stream (when admin toggled on) > free/no paywall
  const paywallStreamId = stream
    ? stream.id                                               // DB live stream takes priority
    : (muxIsLive && !muxIsFree ? muxStreamDbId : undefined); // Mux paywall when admin enables it

  const paywallPrice = stream ? stream.accessPrice : muxPrice;
  const paywallTitle = stream ? stream.title : muxTitle;

  const { data: access, isLoading: loadingAccess } = useStreamAccess(
    isAuthenticated ? paywallStreamId : undefined
  );

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
      qc.invalidateQueries({ queryKey: ['streams', paywallStreamId, 'access'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => {
      toast.error(e.message || 'Purchase failed — check your wallet balance');
    },
  });

  const isLoading = loadingStream || loadingSettings || (!!paywallStreamId && isAuthenticated && loadingAccess);

  // Show paywall only when there is a paywall stream and user hasn't purchased
  const showPaywall = !isLoading && !!paywallStreamId && !access?.hasAccess;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0">
      {/* ── Player area — always visible ─────────────────────── */}
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl w-full">
        {isLoading ? (
          <Skeleton className="absolute inset-0 w-full h-full bg-slate-800" />
        ) : (
          /* Always show a feed — configured HLS URL takes priority, Mux is the default */
          liveStreamUrl
            ? <HlsPlayer hlsUrl={liveStreamUrl} title={stream?.title ?? paywallTitle} />
            : <MuxPlayer playbackId={muxPlaybackId} title={stream?.title ?? paywallTitle} />
        )}

        {/* Paywall overlay — active for DB live stream OR Mux stream when admin enables it */}
        {showPaywall && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm z-10">
            {stream?.thumbnailUrl && (
              <img src={stream.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 -z-10" />
            )}
            <div className="relative text-center px-6 max-w-md">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mb-3 sm:mb-5">
                <Lock className="h-5 w-5 sm:h-7 sm:w-7 text-amber-400" />
              </div>
              <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">Premium Access Required</h3>
              <p className="text-slate-400 text-sm mb-1">{paywallTitle}</p>
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
                      ${paywallPrice.toFixed(2)}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">deducted from your wallet</p>
                  </div>
                  <div>
                    <Button
                      onClick={() => paywallStreamId && purchaseMutation.mutate(paywallStreamId)}
                      disabled={purchaseMutation.isPending || !paywallStreamId}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 sm:px-10 h-10 sm:h-11 text-sm sm:text-base"
                    >
                      {purchaseMutation.isPending ? 'Processing…' : `Pay $${paywallPrice.toFixed(2)} & Watch`}
                    </Button>
                    <p className="text-slate-600 text-xs mt-2 flex items-center justify-center gap-1">
                      <Wallet className="h-3 w-3" /> Charged from your ATA wallet
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Buy Access shortcut bar (below player) ───────────── */}
      {showPaywall && (
        isAuthenticated ? (
          <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-slate-900/80 to-slate-900 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Lock className="h-5 w-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">Unlock Live Access</p>
                <p className="text-slate-400 text-xs mt-0.5 truncate">24-hour access · charged from your wallet</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="text-right shrink-0">
                <p className="text-amber-400 font-bold font-mono text-xl leading-none">${paywallPrice.toFixed(2)}</p>
                <p className="text-slate-600 text-[10px] mt-0.5">one-time</p>
              </div>
              <Button
                onClick={() => paywallStreamId && purchaseMutation.mutate(paywallStreamId)}
                disabled={purchaseMutation.isPending || !paywallStreamId}
                className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold h-11 px-6 text-sm transition-all"
              >
                {purchaseMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                    Processing…
                  </span>
                ) : 'Buy Access & Watch'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-950/40 via-slate-900/80 to-slate-900 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="shrink-0 h-10 w-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                <Lock className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Sign in to watch live</p>
                <p className="text-slate-400 text-xs mt-0.5">${paywallPrice.toFixed(2)} for 24-hour access</p>
              </div>
            </div>
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-bold h-11 px-6 text-sm transition-all">
                Sign In to Watch
              </Button>
            </Link>
          </div>
        )
      )}

      {/* ── No active event nudge (Mux is still playing, just inform about schedule) ── */}
      {!isLoading && !stream && !muxIsLive && <NoLiveBroadcast />}

      {/* Stream info bar — show for DB stream or Mux when live */}
      {(!isLoading && (stream || muxIsLive)) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
              {stream?.sport && (
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{stream.sport}</span>
              )}
              {(stream?.city || stream?.country) && (
                <span className="text-xs text-slate-600">
                  · {[stream?.city, stream?.country].filter(Boolean).join(', ')}
                </span>
              )}
              {muxIsFree && !stream && (
                <span className="text-xs text-emerald-400 font-semibold">FREE</span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white">{stream?.title ?? paywallTitle}</h1>
            {stream?.description && (
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">{stream.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-sm shrink-0">
            <Users className="h-4 w-4 text-teal-500" />
            <span className="font-mono text-white">{stream?.viewerCount ?? 0}</span>
            <span className="text-slate-500">watching</span>
          </div>
        </div>
      )}
    </div>
  );
}
