import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lock, Radio, Users, Wallet, LogIn, Calendar, Timer, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { useAuthStore } from '@/lib/auth-store';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Queries ─────────────────────────────────────────────────────────────────

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

// ─── Players ─────────────────────────────────────────────────────────────────

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
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      return () => hls.destroy();
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(() => {});
    }
    return undefined;
  }, [hlsUrl]);

  useEffect(() => {
    const handleOrientationChange = () => {
      const video = videoRef.current;
      if (!video) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        (video.requestFullscreen?.() ?? (video as any).webkitEnterFullscreen?.())?.catch?.(() => {});
      } else {
        (document.fullscreenElement && document.exitFullscreen?.())?.catch?.(() => {});
      }
    };
    const api = window.screen?.orientation;
    if (api) api.addEventListener('change', handleOrientationChange);
    else window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      if (api) api.removeEventListener('change', handleOrientationChange);
      else window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return (
    <video ref={videoRef} className="w-full h-full object-cover" controls playsInline title={title} />
  );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

interface Countdown { days: number; hours: number; minutes: number; seconds: number; total: number }

function useCountdown(targetIso: string | undefined): Countdown | null {
  const calc = (): Countdown | null => {
    if (!targetIso) return null;
    const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
    if (diff <= 0) return null;
    return {
      total: diff,
      days:    Math.floor(diff / 86400),
      hours:   Math.floor((diff % 86400) / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
    };
  };
  const [countdown, setCountdown] = useState<Countdown | null>(calc);
  useEffect(() => {
    if (!targetIso) return;
    setCountdown(calc());
    const id = setInterval(() => setCountdown(calc()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return countdown;
}

// ─── Countdown display component ─────────────────────────────────────────────

function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl sm:text-4xl font-bold font-mono text-white tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

function CountdownTimer({ targetIso, label }: { targetIso: string; label?: string }) {
  const cd = useCountdown(targetIso);
  if (!cd) return null;
  return (
    <div className="space-y-3">
      {label && (
        <p className="text-slate-400 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-teal-400" />
          {label}
        </p>
      )}
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {cd.days > 0 && <CountdownBlock label="days" value={cd.days} />}
        {cd.days > 0 && <span className="text-slate-600 font-bold text-2xl mb-3">:</span>}
        <CountdownBlock label="hours" value={cd.hours} />
        <span className="text-slate-600 font-bold text-2xl mb-3">:</span>
        <CountdownBlock label="min" value={cd.minutes} />
        <span className="text-slate-600 font-bold text-2xl mb-3">:</span>
        <CountdownBlock label="sec" value={cd.seconds} />
      </div>
    </div>
  );
}

// ─── No broadcast state ───────────────────────────────────────────────────────

function NoLiveBroadcast() {
  const { data: upcoming } = useNextUpcoming();
  const next = upcoming?.[0];
  const nextCountdown = useCountdown(next?.startTime);

  return (
    <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl border border-slate-800 text-center px-6 py-14 w-full">
      <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 border border-slate-700 mb-4 sm:mb-6">
        <Radio className="h-7 w-7 sm:h-9 sm:w-9 text-slate-600" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">No Live Broadcast</h2>
      <p className="text-slate-400 text-sm mb-6 max-w-md">
        There is no live event right now. Come back when the next event starts.
      </p>

      {next && (
        <div className="w-full max-w-sm space-y-4 mb-6">
          {/* Next event card */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-5 py-4">
            <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Next up</p>
            <p className="text-white font-bold text-base sm:text-lg mb-0.5">{next.title}</p>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">{next.sport}</p>
            <p className="text-amber-400 font-mono text-sm">
              {new Date(next.startTime).toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {new Date(next.startTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Live countdown — only when the event is still in the future */}
          {nextCountdown && (
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl px-5 py-5">
              <CountdownTimer targetIso={next.startTime} label="Starts in" />
            </div>
          )}
        </div>
      )}

      <Link href="/upcoming" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
        View full schedule →
      </Link>
    </div>
  );
}

// ─── Sneak Peek countdown hook ───────────────────────────────────────────────

const SNEAK_PEEK_SECONDS = 60;

function useSneakPeek(peekKey: string) {
  const alreadyUsed = () => {
    try { return localStorage.getItem(peekKey) === 'true'; } catch { return false; }
  };
  const markUsed = () => {
    try { localStorage.setItem(peekKey, 'true'); } catch {}
  };

  const [active, setActive] = useState(false);
  const [used, setUsed] = useState(() => alreadyUsed());
  const [secondsLeft, setSecondsLeft] = useState(SNEAK_PEEK_SECONDS);

  // Countdown — only runs while active
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setActive(false);
          setUsed(true);
          markUsed();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const start = () => {
    if (alreadyUsed()) return;
    setSecondsLeft(SNEAK_PEEK_SECONDS);
    setActive(true);
  };

  const skip = () => {
    setActive(false);
    setUsed(true);
    markUsed();
  };

  return { active, used, secondsLeft, start, skip };
}

// ─── Sneak Peek player wrapper ────────────────────────────────────────────────

function SneakPeekPlayer({
  secondsLeft,
  onSkip,
  isAuthenticated,
  children,
}: {
  secondsLeft: number;
  onSkip: () => void;
  isAuthenticated: boolean;
  children: React.ReactNode;
}) {
  const pct = (secondsLeft / SNEAK_PEEK_SECONDS) * 100;
  const urgent = secondsLeft <= 15;

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl w-full">
      {children}

      {/* Top banner */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 pointer-events-none">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-white text-sm font-semibold">
            Sneak Peek Preview
          </span>
          <span className="text-slate-400 text-xs">
            — {isAuthenticated ? 'top up your wallet to keep watching' : 'sign in to keep watching'}
          </span>
        </div>
      </div>

      {/* Bottom countdown bar */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800/80">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${urgent ? 'bg-red-500' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 to-transparent px-4 pt-3 pb-4 pointer-events-auto">
          <div className={`flex items-center gap-2 ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
            <Timer className="h-4 w-4 shrink-0" />
            <span className="font-mono font-bold text-sm tabular-nums">
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
            <span className="text-slate-400 text-xs">preview remaining</span>
          </div>
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Skip preview
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stream preview card (shown when live but no access) ──────────────────────

function StreamGate({
  title,
  description,
  sport,
  thumbnailUrl,
  price,
  isFree,
  isAuthenticated,
  paywallStreamId,
  isPurchasing,
  onPurchase,
  canPreview,
  previewUsed,
  onStartPreview,
}: {
  title: string;
  description?: string | null;
  sport?: string;
  thumbnailUrl?: string | null;
  price: number;
  isFree: boolean;
  isAuthenticated: boolean;
  paywallStreamId: number | undefined;
  isPurchasing: boolean;
  onPurchase: () => void;
  canPreview: boolean;
  previewUsed: boolean;
  onStartPreview: () => void;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 w-full">
      {/* Blurred thumbnail background */}
      {thumbnailUrl && (
        <div className="absolute inset-0 -z-10">
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover blur-md opacity-20 scale-105" />
          <div className="absolute inset-0 bg-slate-900/80" />
        </div>
      )}

      <div className="flex flex-col items-center justify-center text-center px-6 py-14 sm:py-20">
        {/* Live badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1 mb-5">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Live Now</span>
          {sport && <span className="text-slate-500 text-xs">· {sport.toUpperCase()}</span>}
        </div>

        {/* Event title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 max-w-xl">{title}</h2>
        {description && (
          <p className="text-slate-400 text-sm mb-6 max-w-md">{description}</p>
        )}

        {/* Gate content */}
        {!isAuthenticated ? (
          /* ── Not logged in ─────────────────────────────────── */
          <div className="space-y-4 max-w-sm w-full">
            <div className="rounded-xl bg-slate-800 border border-slate-700 px-5 py-4">
              <p className="text-slate-400 text-sm mb-1">To watch this broadcast you need to</p>
              <p className="text-white font-semibold text-base">Sign in to your ATA account</p>
              {!isFree && (
                <p className="text-slate-500 text-xs mt-1">
                  Then purchase <span className="text-amber-400 font-mono font-bold">${price.toFixed(2)}</span> access for 24 hours
                </p>
              )}
            </div>
            <Link href="/login" className="block">
              <Button className="w-full h-12 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-base gap-2">
                <LogIn className="h-5 w-5" />
                Sign In to Watch
              </Button>
            </Link>
            <p className="text-slate-600 text-xs">
              Don't have an account?{' '}
              <Link href="/register" className="text-teal-400 hover:text-teal-300">Create one free</Link>
            </p>
          </div>
        ) : isFree ? (
          /* ── Logged in, free stream — shouldn't normally reach here ── */
          null
        ) : (
          /* ── Logged in, paid stream ────────────────────────────── */
          <div className="space-y-4 max-w-sm w-full">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-4">
              <p className="text-slate-400 text-xs mb-1">24-hour access fee</p>
              <p className="text-amber-400 font-bold text-3xl font-mono">${price.toFixed(2)}</p>
              <p className="text-slate-500 text-xs mt-1">Deducted from your ATA wallet balance</p>
            </div>
            <Button
              onClick={onPurchase}
              disabled={isPurchasing || !paywallStreamId}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base gap-2"
            >
              {isPurchasing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                  Processing…
                </span>
              ) : (
                <>
                  <Wallet className="h-5 w-5" />
                  Pay ${price.toFixed(2)} & Watch Live
                </>
              )}
            </Button>
            <p className="text-slate-500 text-xs flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" />
              Funds deducted from your wallet · 24-hour access
            </p>
          </div>
        )}

        {/* Sneak peek button — shown once, below the gate actions */}
        {canPreview && !previewUsed && (
          <div className="mt-6 pt-5 border-t border-slate-800 w-full max-w-sm">
            <button
              onClick={onStartPreview}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-colors"
            >
              <Eye className="h-4 w-4 text-amber-400 shrink-0" />
              Watch a 1-minute free preview
            </button>
            <p className="text-slate-600 text-[11px] text-center mt-2">One-time preview · no sign-in required</p>
          </div>
        )}
        {previewUsed && (
          <p className="mt-6 text-slate-600 text-xs flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" />
            Free preview already used
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Live() {
  useEffect(() => { document.title = 'Live - ATA Platform'; }, []);

  const { isAuthenticated } = useAuth();
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  const { data: stream, isLoading: loadingStream } = useLiveStream();
  const { data: settings, isLoading: loadingSettings } = useGlobalSettings();

  // ── Derive Mux settings ──────────────────────────────────────────────────
  const liveStreamUrl = settings?.liveStreamUrl ?? '';
  const muxPlaybackId = settings?.mux_playback_id || FALLBACK_MUX_PLAYBACK_ID;
  const muxIsLive     = settings?.mux_is_live === 'true';
  const muxIsFree     = settings?.mux_is_free === 'true';
  const muxPrice      = parseFloat(settings?.mux_price ?? '1.50');
  const muxTitle      = settings?.mux_title || 'ATA Live Stream';
  const muxStreamDbId = settings?.mux_stream_db_id ? Number(settings.mux_stream_db_id) : undefined;

  // ── Is anything live? ────────────────────────────────────────────────────
  // DB stream takes priority over Mux toggle
  const isAnythingLive = !!stream || muxIsLive;

  // ── Paywall stream (which stream ID to check access against) ─────────────
  // DB stream always wins. Fall back to Mux stream DB record when Mux is live + paid.
  const paywallStreamId: number | undefined = stream
    ? stream.id
    : (muxIsLive && !muxIsFree ? muxStreamDbId : undefined);

  const paywallPrice = stream ? stream.accessPrice : muxPrice;
  const paywallTitle = stream ? stream.title : muxTitle;
  const isFreeStream = stream ? false : muxIsFree;

  // ── Access check (only when logged in and something is live) ─────────────
  const { data: access, isLoading: loadingAccess } = useStreamAccess(
    isAuthenticated && paywallStreamId ? paywallStreamId : undefined
  );

  const isLoading = loadingStream || loadingSettings ||
    (isAuthenticated && !!paywallStreamId && loadingAccess);

  // ── Can the user see the player? ─────────────────────────────────────────
  //   YES → authenticated AND (free stream OR has purchased access)
  //   NO  → not logged in, or logged in but hasn't purchased
  const canWatch = isAuthenticated && (isFreeStream || access?.hasAccess === true);

  // ── Sneak peek (1-min preview for locked-out users) ──────────────────────
  const peekKey = `sneak_used_${paywallStreamId ?? 'mux'}`;
  const sneakPeek = useSneakPeek(peekKey);

  // ── Purchase handler ─────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0">

      {isLoading ? (
        /* ── Loading skeleton ─────────────────────────────────── */
        <Skeleton className="w-full aspect-video rounded-xl bg-slate-800" />

      ) : !isAnythingLive ? (
        /* ── Nothing live — show schedule nudge ───────────────── */
        <NoLiveBroadcast />

      ) : canWatch ? (
        /* ── Authenticated + access granted — show the player ─── */
        <>
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl w-full">
            {liveStreamUrl
              ? <HlsPlayer hlsUrl={liveStreamUrl} title={stream?.title ?? paywallTitle} />
              : <MuxPlayer playbackId={muxPlaybackId} title={stream?.title ?? paywallTitle} />
            }
          </div>

          {/* Stream info bar */}
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
                {isFreeStream && (
                  <span className="text-xs text-emerald-400 font-semibold">FREE</span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white">{stream?.title ?? paywallTitle}</h1>
              {stream?.description && (
                <p className="text-slate-400 text-sm mt-1 max-w-2xl">{stream.description}</p>
              )}
              {access?.expiresAt && (
                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Access expires {new Date(access.expiresAt).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-sm shrink-0">
              <Users className="h-4 w-4 text-teal-500" />
              <span className="font-mono text-white">{stream?.viewerCount ?? 0}</span>
              <span className="text-slate-500">watching</span>
            </div>
          </div>
        </>

      ) : sneakPeek.active ? (
        /* ── Sneak peek — show player with countdown overlay ───── */
        <>
          <SneakPeekPlayer
            secondsLeft={sneakPeek.secondsLeft}
            onSkip={sneakPeek.skip}
            isAuthenticated={isAuthenticated}
          >
            {liveStreamUrl
              ? <HlsPlayer hlsUrl={liveStreamUrl} title={stream?.title ?? paywallTitle} />
              : <MuxPlayer playbackId={muxPlaybackId} title={stream?.title ?? paywallTitle} />
            }
          </SneakPeekPlayer>

          {/* Stream title during peek */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
            </span>
            <h1 className="text-lg font-bold text-white">{stream?.title ?? paywallTitle}</h1>
          </div>
        </>

      ) : (
        /* ── Live but no access — show paywall (with optional preview button) */
        <>
          <StreamGate
            title={paywallTitle}
            description={stream?.description}
            sport={stream?.sport}
            thumbnailUrl={stream?.thumbnailUrl}
            price={paywallPrice}
            isFree={isFreeStream}
            isAuthenticated={isAuthenticated}
            paywallStreamId={paywallStreamId}
            isPurchasing={purchaseMutation.isPending}
            onPurchase={() => paywallStreamId && purchaseMutation.mutate(paywallStreamId)}
            canPreview={isAnythingLive}
            previewUsed={sneakPeek.used}
            onStartPreview={sneakPeek.start}
          />

          {/* Upcoming schedule below the gate */}
          <UpcomingSchedule />
        </>
      )}
    </div>
  );
}

function UpcomingRow({ ev }: { ev: UpcomingStream }) {
  const cd = useCountdown(ev.startTime);

  // Format a compact "Xd Xh" or "Xh Xm" or "Xm Xs" label
  const label = cd
    ? cd.days > 0
      ? `${cd.days}d ${cd.hours}h`
      : cd.hours > 0
        ? `${cd.hours}h ${String(cd.minutes).padStart(2, '0')}m`
        : `${cd.minutes}m ${String(cd.seconds).padStart(2, '0')}s`
    : null;

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-800 last:border-0">
      <div className="min-w-0">
        <p className="text-white text-sm font-medium leading-tight truncate">{ev.title}</p>
        <p className="text-slate-500 text-xs mt-0.5 uppercase tracking-wide">{ev.sport}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-amber-400 font-mono text-xs">
          {new Date(ev.startTime).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {new Date(ev.startTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {label && (
          <p className="text-teal-400 font-mono text-[11px] mt-0.5 flex items-center justify-end gap-1">
            <Timer className="h-3 w-3" />
            in {label}
          </p>
        )}
      </div>
    </div>
  );
}

function UpcomingSchedule() {
  const { data: upcoming } = useNextUpcoming();
  if (!upcoming?.length) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-teal-500" />
        <h3 className="text-sm font-semibold text-white">Upcoming Events</h3>
      </div>
      <div className="space-y-0">
        {upcoming.slice(0, 3).map((ev) => (
          <UpcomingRow key={ev.id} ev={ev} />
        ))}
      </div>
      <Link href="/upcoming" className="text-teal-400 hover:text-teal-300 text-xs mt-3 inline-block transition-colors">
        View full schedule →
      </Link>
    </div>
  );
}
