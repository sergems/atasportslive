import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useSEO, makeBreadcrumb, SITE_URL } from '@/lib/seo';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Lock, Radio, Users, Wallet, LogIn, Calendar, Timer, Eye, EyeOff, MessageSquare, Send, Swords, PanelRightClose, PanelRightOpen, Volume2, Volume1, VolumeX, Play, Pause, Maximize, Minimize } from 'lucide-react';
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

function useGlobalSettings() {
  // Use the public endpoint — no auth required, safe for all viewers.
  // Separate query key from the admin 'settings' cache to avoid collisions.
  return useQuery<Record<string, string>>({
    queryKey: ['settings', 'public'],
    queryFn: () => fetch('/api/settings/public').then((r) => r.json()),
    refetchInterval: 30000,
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

// ─── Orientation → fullscreen ───────────────────────────────────────────────

/**
 * Fullscreen for a player, covering both:
 *  1. Auto-trigger on device rotation to landscape (and back on portrait).
 *  2. A manual toggle via an on-player button.
 *
 * Strategy (avoids iframe remount = no stream interruption):
 *
 *  PRIMARY — native Fullscreen API on the container element itself.
 *  The browser takes the element fullscreen natively; parent CSS transforms
 *  (e.g. Framer Motion page transitions) do not affect it because the browser
 *  composites it independently. This also hides the address bar on Android
 *  Chrome. State is driven entirely by the 'fullscreenchange' event — we
 *  never write isFullscreen=true speculatively so there's no desync.
 *
 *  FALLBACK — CSS portal overlay (createPortal into document.body).
 *  Used only when native FS is unavailable (iOS Safari refuses requestFullscreen
 *  on non-<video> divs). The portal bypasses parent stacking contexts. This
 *  path does unmount/remount the iframe, which causes a brief stream reload —
 *  acceptable since iOS doesn't hide browser chrome either way.
 *
 *  `portalFullscreen` is the flag callers use to decide which path is active.
 */
function usePlayerFullscreen(ref: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // true only when we fell back to the CSS portal path (native FS unavailable)
  const [portalFullscreen, setPortalFullscreen] = useState(false);

  const lockLandscape = () => {
    try {
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
        ?.lock?.('landscape').catch(() => {});
    } catch {}
  };
  const unlockOrientation = () => {
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
    } catch {}
  };

  // Activate portal fallback (iOS / environments without native FS on divs).
  const enterPortal = useCallback(() => {
    setPortalFullscreen(true);
    setIsFullscreen(true);
    document.body.style.overflow = 'hidden';
    lockLandscape();
  }, []);

  const exitPortal = useCallback(() => {
    setPortalFullscreen(false);
    setIsFullscreen(false);
    document.body.style.overflow = '';
    unlockOrientation();
  }, []);

  const enter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    lockLandscape();
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => void };
    const p: Promise<void> | null = el.requestFullscreen
      ? el.requestFullscreen({ navigationUI: 'hide' })
      : anyEl.webkitRequestFullscreen
        ? (anyEl.webkitRequestFullscreen(), Promise.resolve())
        : null;
    if (p === null) {
      // No FS API at all — portal only
      enterPortal();
    } else {
      // State driven by fullscreenchange on success.
      // On rejection (iOS) fall back to portal.
      p.catch(() => enterPortal());
    }
  }, [ref, enterPortal]);

  const exit = useCallback(() => {
    if (portalFullscreen) {
      exitPortal();
      return;
    }
    unlockOrientation();
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      (document.exitFullscreen
        ? document.exitFullscreen()
        : Promise.resolve(doc.webkitExitFullscreen?.())
      ).catch(() => {});
      // isFullscreen cleared by the fullscreenchange listener below
    } else {
      // Native FS already gone (shouldn't normally happen — keep state clean)
      setIsFullscreen(false);
    }
  }, [portalFullscreen, exitPortal]);

  const toggle = useCallback(() => {
    if (isFullscreen) exit(); else enter();
  }, [isFullscreen, enter, exit]);

  // Sync state from native fullscreenchange (enter AND exit).
  // This is the only place isFullscreen is set for the native path.
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      if (fsEl) {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
        setPortalFullscreen(false);
        document.body.style.overflow = '';
        unlockOrientation();
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Auto rotate-to-fullscreen on touch devices only.
  useEffect(() => {
    const isTouchDevice = typeof window !== 'undefined' &&
      (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    if (!isTouchDevice) return undefined;

    const handleOrientationChange = () => {
      const el = ref.current;
      if (!el) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      if (isLandscape) {
        const rect = el.getBoundingClientRect();
        const inView = rect.bottom > 0 && rect.top < window.innerHeight;
        if (inView) enter();
      } else {
        exit();
      }
    };
    const api = window.screen?.orientation;
    if (api) api.addEventListener('change', handleOrientationChange);
    else window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      if (api) api.removeEventListener('change', handleOrientationChange);
      else window.removeEventListener('orientationchange', handleOrientationChange);
      exit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return { isFullscreen, portalFullscreen, toggle };
}

function FullscreenButton({ isFullscreen, onToggle, className }: { isFullscreen: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      onClick={onToggle}
      className={className ?? 'flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-black/80 hover:border-teal-500/50 transition-colors'}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
    </button>
  );
}

const CONTROLS_HIDE_DELAY_MS = 3000;

/**
 * Auto-hides player controls after a few seconds of no interaction, and
 * brings them back on mouse move / touch / tap over the player. Returns a
 * `visible` flag plus the mouse/touch handlers to spread onto the player's
 * container element.
 */
function useControlsAutoHide() {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const show = useCallback(() => {
    setVisible(true);
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    show();
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    visible,
    handlers: {
      onMouseMove: show,
      onMouseEnter: show,
      onTouchStart: show,
      onClick: show,
    },
  };
}

// ─── Players ─────────────────────────────────────────────────────────────────

const FALLBACK_MUX_PLAYBACK_ID = 'QEQX7ir02QjD1eYSV00vdTr8waLZof6bisQLNWzom00sZ00';

export function MuxPlayer({ playbackId, title }: { playbackId: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  usePlayerFullscreen(containerRef);
  return (
    <div ref={containerRef} className="relative w-full h-full">
      <iframe
        src={`https://player.mux.com/${playbackId}?autoplay=true&muted=false`}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

export function YouTubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, portalFullscreen, toggle: toggleFullscreen } = usePlayerFullscreen(containerRef);
  const { visible: controlsVisible, handlers: controlsHandlers } = useControlsAutoHide();
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  // true for a few seconds right after (re)loading a video, while YouTube's
  // title/channel card is still animating in/out — covered with solid bars
  const [justSwitched, setJustSwitched] = useState(true);
  // remember last non-zero volume so unmuting restores it
  const lastVolumeRef = useRef(100);
  // once the user manually pauses, stop the autoplay-recovery nudges from fighting them
  const userPausedRef = useRef(false);

  function send(func: string, args: unknown[] = []) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*'
    );
  }

  function applyToPlayer(vol: number, isMuted: boolean) {
    if (isMuted) {
      send('mute');
    } else {
      send('unMute');
      send('setVolume', [vol]);
    }
  }

  useEffect(() => {
    let initialised = false;
    // reset UI state whenever the video changes so we don't act on stale
    // readiness assumptions from the previous video
    setReady(false);
    // cover the feed with solid bars for a few seconds after switching —
    // YouTube's title/channel card animates in on load and there's no
    // param that fully suppresses it, so we hide it behind opaque bars
    // instead until it's had time to disappear on its own
    setJustSwitched(true);
    const switchCoverTimer = setTimeout(() => setJustSwitched(false), 7000);

    let playerState: number | null = null;

    function disableCaptions() {
      // cc_load_policy=0 in the URL only stops auto-loading for videos that
      // don't force captions on — some broadcasts force them on regardless,
      // so we also clear the caption track directly via the player API,
      // which works even when the uploader/livestream forces captions.
      send('setOption', ['captions', 'track', {}]);
      send('unloadModule', ['captions']);
    }

    function init() {
      if (initialised) return;
      initialised = true;
      send('unMute');
      send('setVolume', [100]);
      disableCaptions();
      setMuted(false);
      setVolume(100);
      setReady(true);
    }

    // Mobile browsers frequently refuse to autoplay a cross-origin iframe's
    // <video> even with autoplay=1&mute=1 in the URL — YouTube then shows
    // its own paused "tap to play" overlay instead of starting on its own.
    // We work around it by explicitly issuing the playVideo command right
    // away, and repeatedly for the first several seconds in case the iframe
    // wasn't ready yet, plus once more on the visitor's very first tap
    // anywhere on the page (which YouTube's own overlay button would have
    // required anyway, just aimed at the wrong target).
    function commandPlay() {
      send('playVideo');
      disableCaptions();
    }
    commandPlay();
    const playRetries = [300, 800, 1500, 2500, 4000, 6000].map((delay) =>
      setTimeout(() => { if (playerState !== 1) commandPlay(); else disableCaptions(); }, delay)
    );

    const interactionEvents: Array<keyof DocumentEventMap> = ['touchstart', 'touchend', 'click', 'keydown'];
    function unstickOnFirstInteraction() {
      const kick = () => {
        commandPlay();
        interactionEvents.forEach((ev) => document.removeEventListener(ev, kick));
      };
      interactionEvents.forEach((ev) => document.addEventListener(ev, kick, { once: true, passive: true }));
      return kick; // returned so we can remove on cleanup if never fired
    }
    const kickRef = unstickOnFirstInteraction();

    function onMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onReady') { init(); commandPlay(); }
        if (data?.event === 'infoDelivery' && typeof data?.info?.playerState === 'number') {
          playerState = data.info.playerState;
          if (playerState === 1) {
            init();
            // Video is actually playing — remove the cover bars immediately
            // instead of waiting for the 7-second timer to expire.
            setJustSwitched(false);
          }
          setIsPlaying(playerState === 1 || playerState === 3);
          // 2 = paused, 5 = cued — both mean autoplay didn't take; nudge it again
          // (only auto-nudge before the user has taken manual control)
          if ((playerState === 2 || playerState === 5) && !userPausedRef.current) commandPlay();
        }
      } catch {}
    }

    window.addEventListener('message', onMessage);
    const fallback = setTimeout(init, 1500);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(fallback);
      clearTimeout(switchCoverTimer);
      playRetries.forEach(clearTimeout);
      // Remove first-interaction listeners if they were never triggered
      interactionEvents.forEach((ev) => document.removeEventListener(ev, kickRef));
    };
  }, [videoId]);

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setVolume(val);
    if (val > 0) lastVolumeRef.current = val;
    const nowMuted = val === 0;
    setMuted(nowMuted);
    applyToPlayer(val, nowMuted);
  }

  function handleToggleMute() {
    const next = !muted;
    setMuted(next);
    if (!next && volume === 0) {
      // restore last known volume when unmuting from 0
      const restored = lastVolumeRef.current || 100;
      setVolume(restored);
      applyToPlayer(restored, false);
    } else {
      applyToPlayer(volume, next);
    }
  }

  function handleTogglePlay() {
    if (isPlaying) {
      userPausedRef.current = true;
      send('pauseVideo');
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      send('playVideo');
      setIsPlaying(true);
    }
  }

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  const src = new URLSearchParams({
    autoplay: '1', mute: '1', rel: '0', modestbranding: '1',
    iv_load_policy: '3', playsinline: '1', controls: '0',
    fs: '0', disablekb: '1', enablejsapi: '1', origin: window.location.origin,
    cc_load_policy: '0', cc_lang_pref: 'none',
  });

  // ── Player inner content ────────────────────────────────────────────────────
  // Extracted so it can be rendered either in-place or inside a portal without
  // duplicating JSX. The iframe ref is always attached here, so the YouTube
  // postMessage API keeps working regardless of where this tree is mounted.
  const playerInner = (
    <div className="relative w-full h-full bg-black">
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${src.toString()}`}
        title={title}
        className="absolute inset-0 w-full h-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      />

      {/* Block layer — absorbs all pointer events on the iframe surface so
          YouTube's own chrome (title card, suggested videos, end cards) can
          never appear. Also wakes the controls auto-hide timer on interaction. */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{ cursor: 'default' }}
        onClickCapture={(e) => e.preventDefault()}
        {...controlsHandlers}
        aria-hidden="true"
      />

      {/* Overlay — pointer-events-none except for the control buttons */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Solid black bars for a few seconds after switching — hides YouTube's
            title/channel card that briefly animates in on load */}
        <div
          className={`absolute top-0 inset-x-0 h-[22%] sm:h-[12.5%] bg-black transition-opacity duration-700 ${
            justSwitched ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`absolute bottom-0 inset-x-0 h-[22%] sm:h-[12.5%] bg-black transition-opacity duration-700 ${
            justSwitched ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Controls + top gradient — fade together on inactivity */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Top gradient hides YouTube's title/channel card; inside the fade
              wrapper so it doesn't permanently darken the feed */}
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-slate-950 via-slate-950/70 to-transparent" />

          {ready && (
            <div
              className="absolute bottom-14 left-3 flex items-center gap-2 pointer-events-auto"
              onMouseEnter={() => setExpanded(true)}
              onMouseLeave={() => setExpanded(false)}
              {...controlsHandlers}
            >
              {/* Volume slider */}
              <div
                className={`flex items-center transition-all duration-200 overflow-hidden ${
                  expanded ? 'w-24 opacity-100' : 'w-0 opacity-0'
                }`}
              >
                <input
                  type="range" min={0} max={100}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 accent-teal-400 cursor-pointer"
                  aria-label="Volume"
                />
              </div>

              <button
                onClick={handleToggleMute}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-black/80 hover:border-teal-500/50 transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon className="w-4 h-4" />
              </button>

              <button
                onClick={handleTogglePlay}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-white hover:bg-black/80 hover:border-teal-500/50 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
            </div>
          )}

          {ready && !isPlaying && (
            <button
              onClick={handleTogglePlay}
              className="absolute inset-0 flex items-center justify-center pointer-events-auto"
              aria-label="Play"
            >
              <span className="flex items-center justify-center w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white hover:bg-black/80 transition-colors">
                <Play className="w-7 h-7 ml-1" />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Rendering strategy ───────────────────────────────────────────────────────
  // PRIMARY (Android Chrome, desktop): native Fullscreen API is used on
  // containerRef itself. The browser composites it fullscreen natively,
  // bypassing parent CSS transforms. playerInner stays mounted inside
  // containerRef the whole time — no iframe remount, no stream interruption.
  //
  // FALLBACK (iOS Safari): div.requestFullscreen() is unsupported; we fall
  // back to portalFullscreen = a createPortal fixed overlay. This does remount
  // the iframe, but on iOS there is no way to hide browser chrome regardless,
  // so the UX cost is acceptable.
  return (
    <>
      {/* containerRef always stays in the DOM for orientation detection.
          When using native FS the browser takes this element fullscreen;
          playerInner is always mounted here on the native path. */}
      <div ref={containerRef} className="relative w-full h-full bg-black">
        {!portalFullscreen && playerInner}
      </div>

      {/* Portal fallback — iOS only. createPortal bypasses stacking contexts. */}
      {portalFullscreen && createPortal(
        <div
          className="fixed inset-0 bg-black"
          style={{ zIndex: 2147483647 }}
        >
          {playerInner}
        </div>,
        document.body,
      )}
    </>
  );
}

export function HlsPlayer({ hlsUrl, title }: { hlsUrl: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = usePlayerFullscreen(containerRef);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Mobile browsers only allow autoplay to start at all when the video is
    // declared muted (the `muted` attribute below) *before* play() is ever
    // called. We keep it simply muted — no post-play unmute attempts, since
    // those can trigger the browser to pause playback again. Users control
    // sound themselves via our own volume control UI.
    function startPlayback() {
      if (!video) return;
      video.muted = true;
      video.play().catch(() => {});
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      return () => {
        hls.destroy();
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
      };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      startPlayback();
    }
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [hlsUrl]);

  function handleTogglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black">
      <video ref={videoRef} className="w-full h-full object-cover" controls autoPlay muted playsInline title={title} />

      {/* Manual controls, kept alongside the native <video> controls so a
          fullscreen button is always available even where native browser
          controls hide or omit one */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
        </div>
      </div>

      {!isPlaying && (
        <button
          onClick={handleTogglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white hover:bg-black/80 transition-colors">
            <Play className="w-7 h-7 ml-1" />
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

interface Countdown { days: number; hours: number; minutes: number; seconds: number; total: number }

function useCountdown(targetIso: string | undefined): Countdown | null {
  const calc = (): Countdown | null => {
    if (!targetIso) return null;
    const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
    if (diff <= 0) return null;
    return { total: diff, days: Math.floor(diff / 86400), hours: Math.floor((diff % 86400) / 3600), minutes: Math.floor((diff % 3600) / 60), seconds: diff % 60 };
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

function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold font-mono text-white tabular-nums leading-none">{String(value).padStart(2, '0')}</span>
      <span className="text-slate-500 text-[9px] uppercase tracking-widest mt-0.5">{label}</span>
    </div>
  );
}

function CountdownTimer({ targetIso, label }: { targetIso: string; label?: string }) {
  const cd = useCountdown(targetIso);
  if (!cd) return null;
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-1 shrink-0">
          <Timer className="h-3 w-3 text-teal-400" />{label}
        </span>
      )}
      <div className="flex items-center gap-2">
        {cd.days > 0 && <CountdownBlock label="days" value={cd.days} />}
        {cd.days > 0 && <span className="text-slate-600 font-bold text-sm">:</span>}
        <CountdownBlock label="hrs" value={cd.hours} />
        <span className="text-slate-600 font-bold text-sm">:</span>
        <CountdownBlock label="min" value={cd.minutes} />
        <span className="text-slate-600 font-bold text-sm">:</span>
        <CountdownBlock label="sec" value={cd.seconds} />
      </div>
    </div>
  );
}

// ─── No broadcast state ───────────────────────────────────────────────────────

function NoLiveBroadcast({ channelLabel }: { channelLabel: string }) {
  const { data: upcoming } = useNextUpcoming();
  const next = upcoming?.[0];
  const nextCountdown = useCountdown(next?.startTime);
  return (
    /* Card — taller on mobile (4:3) so content isn't squeezed, 16:9 on sm+ */
    <div className="relative w-full sm:max-w-[85%] lg:max-w-[60%] mx-auto aspect-[4/3] sm:aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(20,184,166,0.06)_0%,_transparent_70%)]" />

      {/* Centre content — push up so it clears the bottom bar */}
      <div className="flex flex-col items-center gap-3 px-4 sm:px-6 text-center z-10 pb-16 sm:pb-10">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center">
          <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm sm:text-base">No Live Broadcast</p>
          <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5">{channelLabel} is not live right now.</p>
        </div>
        {next && nextCountdown && (
          <div className="mt-1">
            <CountdownTimer targetIso={next.startTime} label="Starts in" />
          </div>
        )}
      </div>

      {/* Next-up bar pinned to bottom */}
      {next && (
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 z-10">
          {/* Mobile: two stacked rows */}
          <div className="flex flex-col gap-1 sm:hidden">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest shrink-0">Next up</span>
              <span className="text-white text-xs font-semibold truncate">{next.title}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-amber-400 font-mono text-[11px]">
                {new Date(next.startTime).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}
                {new Date(next.startTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Link href="/upcoming" className="text-teal-400 hover:text-teal-300 text-[11px] shrink-0 transition-colors">
                Schedule →
              </Link>
            </div>
          </div>
          {/* Tablet+: single row */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest shrink-0">Next up</span>
              <span className="text-white text-sm font-semibold truncate">{next.title}</span>
              {next.sport && <span className="text-[10px] text-slate-500 uppercase shrink-0">{next.sport}</span>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-amber-400 font-mono text-xs">
                {new Date(next.startTime).toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(next.startTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Link href="/upcoming" className="text-teal-400 hover:text-teal-300 text-xs transition-colors">
                Schedule →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Schedule link when no next event */}
      {!next && (
        <Link href="/upcoming" className="absolute bottom-4 text-teal-400 hover:text-teal-300 text-xs transition-colors z-10">
          View full schedule →
        </Link>
      )}
    </div>
  );
}

// ─── Sneak Peek ───────────────────────────────────────────────────────────────

const SNEAK_PEEK_SECONDS = 60;

function useSneakPeek(peekKey: string) {
  // Visiting with ?resetPreview=1 clears this stream's one-time preview flag
  // so it can be watched again — handy for testing without opening devtools.
  const alreadyUsed = () => { try { return localStorage.getItem(peekKey) === 'true'; } catch { return false; } };
  const markUsed = () => { try { localStorage.setItem(peekKey, 'true'); } catch {} };
  const [active, setActive] = useState(false);
  const [used, setUsed] = useState(() => alreadyUsed());

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('resetPreview') === '1') {
        localStorage.removeItem(peekKey);
        setUsed(false);
        params.delete('resetPreview');
        const newSearch = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [secondsLeft, setSecondsLeft] = useState(SNEAK_PEEK_SECONDS);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); setActive(false); setUsed(true); markUsed(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);
  const start = () => { if (alreadyUsed()) return; setSecondsLeft(SNEAK_PEEK_SECONDS); setActive(true); };
  const skip = () => { setActive(false); setUsed(true); markUsed(); };
  return { active, used, secondsLeft, start, skip };
}

function SneakPeekPlayer({ secondsLeft, onSkip, isAuthenticated, children }: { secondsLeft: number; onSkip: () => void; isAuthenticated: boolean; children: React.ReactNode }) {
  const pct = (secondsLeft / SNEAK_PEEK_SECONDS) * 100;
  const urgent = secondsLeft <= 15;
  const containerRef = useRef<HTMLDivElement>(null);
  usePlayerFullscreen(containerRef);
  return (
    <div ref={containerRef} className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl w-full">
      {children}
      {/* Solid (non-fading) backing so the underlying video never bleeds
          through the overlay text on any screen size */}
      <div className="absolute top-0 inset-x-0 flex flex-col gap-0.5 bg-slate-950/95 px-2.5 sm:px-4 py-2 sm:py-2.5 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
          <span className="text-white text-xs sm:text-sm font-semibold truncate">Sneak Peek Preview</span>
        </div>
        <span className="text-slate-300 text-[10px] sm:text-xs pl-5 sm:pl-6 truncate">
          {isAuthenticated ? 'Top up your wallet to keep watching' : 'Sign in to keep watching'}
        </span>
      </div>
      <div className="absolute bottom-0 inset-x-0 pointer-events-none">
        <div className="h-1 bg-slate-800/80">
          <div className={`h-full transition-all duration-1000 ease-linear ${urgent ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2 sm:gap-3 bg-slate-950/95 px-2.5 sm:px-4 pt-2 sm:pt-2.5 pb-2.5 sm:pb-3 pointer-events-auto">
          <div className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
            <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="font-mono font-bold text-xs sm:text-sm tabular-nums shrink-0">{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</span>
            <span className="text-slate-400 text-[10px] sm:text-xs truncate hidden sm:inline">preview remaining</span>
          </div>
          <button onClick={onSkip} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-400 hover:text-white transition-colors shrink-0">
            <EyeOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" /><span className="hidden sm:inline">Skip preview</span><span className="sm:hidden">Skip</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── StreamGate ───────────────────────────────────────────────────────────────

const SUB_OPTIONS = [
  { key: 'daily'   as const, label: 'Daily',   duration: '24 hours' },
  { key: 'weekly'  as const, label: 'Weekly',  duration: '7 days'   },
  { key: 'monthly' as const, label: 'Monthly', duration: '30 days'  },
  { key: 'yearly'  as const, label: 'Yearly',  duration: '365 days' },
];

function StreamGate({ title, description, sport, thumbnailUrl, prices, selectedSubType, onSelectSubType, isFree, isAuthenticated, paywallStreamId, isPurchasing, onPurchase, canPreview, previewUsed, onStartPreview }: {
  title: string; description?: string | null; sport?: string; thumbnailUrl?: string | null;
  prices: { daily: number; weekly: number; monthly: number; yearly: number };
  selectedSubType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  onSelectSubType: (t: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  isFree: boolean; isAuthenticated: boolean; paywallStreamId: number | undefined;
  isPurchasing: boolean; onPurchase: () => void;
  canPreview: boolean; previewUsed: boolean; onStartPreview: () => void;
}) {
  const selectedPrice = prices[selectedSubType];
  const selectedOption = SUB_OPTIONS.find(o => o.key === selectedSubType)!;
  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 w-full">
      {thumbnailUrl && (
        <div className="absolute inset-0 -z-10">
          <img src={thumbnailUrl} alt="" className="w-full h-full object-cover blur-md opacity-20 scale-105" />
          <div className="absolute inset-0 bg-slate-900/80" />
        </div>
      )}
      <div className="flex flex-col items-center justify-center text-center px-6 py-14 sm:py-20">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1 mb-5">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Live Now</span>
          {sport && <span className="text-slate-500 text-xs">· {sport.toUpperCase()}</span>}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 max-w-xl">{title}</h2>
        {description && <p className="text-slate-400 text-sm mb-6 max-w-md">{description}</p>}
        {!isAuthenticated ? (
          <div className="space-y-4 max-w-sm w-full">
            <div className="rounded-xl bg-slate-800 border border-slate-700 px-5 py-4">
              <p className="text-slate-400 text-sm mb-1">To watch this broadcast you need to</p>
              <p className="text-white font-semibold text-base">Sign in to your ATA account</p>
              {!isFree && <p className="text-slate-500 text-xs mt-1">Then choose a subscription — from <span className="text-amber-400 font-mono font-bold">${prices.daily.toFixed(2)}</span>/day</p>}
            </div>
            <Link href="/login" className="block">
              <Button className="w-full h-12 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-base gap-2">
                <LogIn className="h-5 w-5" />Sign In to Watch
              </Button>
            </Link>
            <p className="text-slate-600 text-xs">Don't have an account?{' '}<Link href="/register" className="text-teal-400 hover:text-teal-300">Create one free</Link></p>
          </div>
        ) : isFree ? null : (
          <div className="space-y-4 max-w-sm w-full">
            <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-800/60 border border-slate-700 p-1">
              {SUB_OPTIONS.map(opt => (
                <button key={opt.key} type="button" onClick={() => onSelectSubType(opt.key)}
                  className={`rounded-lg py-2 px-1 text-center transition-all duration-200 ${selectedSubType === opt.key ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                  <p className="text-xs font-bold leading-tight">{opt.label}</p>
                  <p className={`text-[10px] mt-0.5 font-mono font-semibold ${selectedSubType === opt.key ? 'text-slate-900' : 'text-slate-500'}`}>${prices[opt.key].toFixed(2)}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-4">
              <p className="text-slate-400 text-xs mb-1">{selectedOption.label} access · {selectedOption.duration}</p>
              <p className="text-amber-400 font-bold text-3xl font-mono">${selectedPrice.toFixed(2)}</p>
              <p className="text-slate-500 text-xs mt-1">Deducted from your ATA wallet balance</p>
            </div>
            <Button onClick={onPurchase} disabled={isPurchasing || !paywallStreamId}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base gap-2">
              {isPurchasing ? <span className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />Processing…</span>
                : <><Wallet className="h-5 w-5" />Pay ${selectedPrice.toFixed(2)} · {selectedOption.duration}</>}
            </Button>
            <p className="text-slate-500 text-xs flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" />Funds deducted from your wallet · {selectedOption.duration} access
            </p>
          </div>
        )}
        {canPreview && !previewUsed && (
          <div className="mt-6 pt-5 border-t border-slate-800 w-full max-w-sm">
            <button onClick={onStartPreview} className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:text-white transition-colors">
              <Eye className="h-4 w-4 text-amber-400 shrink-0" />Watch a 1-minute free preview
            </button>
            <p className="text-slate-600 text-[11px] text-center mt-2">One-time preview · no sign-in required</p>
          </div>
        )}
        {previewUsed && <p className="mt-6 text-slate-600 text-xs flex items-center gap-1.5"><EyeOff className="h-3.5 w-3.5" />Free preview already used</p>}
      </div>
    </div>
  );
}

// ─── Live Comment Section ─────────────────────────────────────────────────────

interface LiveComment { id: number; userId: number; username: string; content: string; createdAt: string; }

const COMMENT_TTL_MS = 6 * 60 * 60 * 1000;
const QUICK_EMOJIS = ['😂','❤️','🔥','👏','💪','🎯','🥊','🏆','😮','👍','😅','🤣','😁','💯','🙌','👀','😱','🤩','🎉','💥','⚡','🥳','😤','👊','🏅','🎊','🤝','💰','😎','🫡'];

function CommentSection({ streamId, token, userId, isAuthenticated, onReaction, onViewerCount }: {
  streamId: number | undefined; token: string | null; userId: number | undefined;
  isAuthenticated: boolean; onReaction?: (emoji: string) => void;
  onViewerCount?: (count: number) => void;
}) {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [input, setInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const onReactionRef = useRef(onReaction);
  useEffect(() => { onReactionRef.current = onReaction; }, [onReaction]);
  const onViewerCountRef = useRef(onViewerCount);
  useEffect(() => { onViewerCountRef.current = onViewerCount; }, [onViewerCount]);

  useEffect(() => {
    if (!showEmojis) return;
    const handler = (e: MouseEvent) => {
      if (!emojiPanelRef.current?.contains(e.target as Node) && !emojiBtnRef.current?.contains(e.target as Node)) setShowEmojis(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojis]);

  useEffect(() => {
    if (!streamId) return;
    fetch(`/api/streams/${streamId}/comments`).then((r) => r.json()).then((data) => setComments(data.comments || [])).catch(() => {});
  }, [streamId]);

  useEffect(() => {
    if (!streamId) return;
    let destroyed = false;
    let reconnect: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (destroyed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws?streamId=${streamId}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'stream_comment' && data.comment) {
            const age = Date.now() - new Date(data.comment.createdAt).getTime();
            if (age > COMMENT_TTL_MS) return;
            setComments((prev) => prev.some((c) => c.id === data.comment.id) ? prev : [...prev, data.comment]);
          } else if (data.type === 'stream_reaction' && data.emoji) {
            onReactionRef.current?.(data.emoji);
          } else if (data.type === 'viewer_count' && typeof data.count === 'number') {
            onViewerCountRef.current?.(data.count);
          }
        } catch {}
      };
      ws.onclose = () => { if (!destroyed) reconnect = setTimeout(connect, 3000); };
    };
    connect();
    return () => { destroyed = true; clearTimeout(reconnect); wsRef.current?.close(); };
  }, [streamId, token]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const postComment = async () => {
    if (!input.trim() || !streamId || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/streams/${streamId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: input.trim() }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
      setInput('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 shrink-0">
        <MessageSquare className="h-4 w-4 text-teal-400" />
        <span className="text-sm font-semibold text-white">Live Chat</span>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{comments.length} msgs</span>
      </div>
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 max-h-[218px] lg:max-h-[380px]">
        {comments.length === 0 && <p className="text-center text-slate-600 text-xs mt-10">No messages yet. Be the first!</p>}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2 items-start">
            <div className="h-6 w-6 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0 text-[10px] font-bold text-teal-400 mt-0.5">{c.username[0]?.toUpperCase() ?? '?'}</div>
            <div className="min-w-0 flex-1">
              <span className="text-teal-400 text-[11px] font-semibold mr-1.5">{c.username}</span>
              <span className="text-slate-300 text-[13px] break-words">{c.content}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-slate-800 px-2 py-2">
        {isAuthenticated ? (
          <div className="relative">
            {showEmojis && (
              <div ref={emojiPanelRef} className="absolute bottom-full mb-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl p-2 grid grid-cols-6 gap-0.5 z-20 shadow-xl">
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => { setInput((p) => p + emoji); setShowEmojis(false); }}
                    className="text-lg hover:bg-slate-700 rounded-lg p-1 transition-colors text-center leading-none">{emoji}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <button ref={emojiBtnRef} onClick={() => setShowEmojis((s) => !s)}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-base transition-colors" title="Add emoji">😊</button>
              <input
                className="flex-1 bg-slate-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-teal-500/50 min-w-0"
                placeholder="Say something…" value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                maxLength={280}
              />
              <button onClick={postComment} disabled={posting || !input.trim()}
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {posting ? <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" /> : <Send className="h-3.5 w-3.5 text-slate-950" />}
              </button>
            </div>
          </div>
        ) : (
          <Link href="/login">
            <button className="w-full text-center text-xs text-slate-500 hover:text-teal-400 transition-colors py-1">Sign in to chat</button>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Floating Emoji Reactions ─────────────────────────────────────────────────

const FLOAT_KEYFRAMES = `@keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 70% { transform: translateY(-140px) scale(1.35); opacity: 0.85; } 100% { transform: translateY(-200px) scale(0.9); opacity: 0; } }`;
interface FloatingReaction { id: string; emoji: string; x: number }
const REACTION_EMOJIS = ['🔥', '❤️', '💪', '👏', '😂', '🎯'] as const;

function FloatingReactionsLayer({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <>
      <style>{FLOAT_KEYFRAMES}</style>
      {reactions.map((r) => (
        <div key={r.id} className="absolute bottom-14 pointer-events-none text-3xl select-none drop-shadow-lg"
          style={{ left: `${r.x}%`, animation: 'floatUp 2.4s ease-out forwards' }}>{r.emoji}</div>
      ))}
    </>
  );
}

function ReactionBar({ streamId, token, isAuthenticated }: { streamId: number | undefined; token: string | null; isAuthenticated: boolean }) {
  const [cooldown, setCooldown] = useState(false);
  const sendReaction = async (emoji: string) => {
    if (!streamId || !token || cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 800);
    try { await fetch(`/api/streams/${streamId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ emoji }) }); } catch {}
  };
  if (!isAuthenticated || !streamId) return null;
  return (
    <div className="flex items-center gap-0.5">
      {REACTION_EMOJIS.map((emoji) => (
        <button key={emoji} onClick={() => sendReaction(emoji)} disabled={cooldown}
          className="text-xl leading-none px-1.5 py-1 rounded-lg hover:bg-slate-800 hover:scale-125 active:scale-110 transition-all disabled:opacity-50 disabled:scale-100" title="React">{emoji}</button>
      ))}
    </div>
  );
}

// ─── Quick P2P Bet Panel ──────────────────────────────────────────────────────

interface QuickGame { id: number; playerA: string; playerB: string; sport: string; openBetsCount: number; totalBetPool: string; }

function QuickBetPanel({ token, streamSport }: { token: string | null; streamSport?: string }) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<'player_a_wins' | 'player_b_wins' | null>(null);
  const [stake, setStake] = useState('');
  const [placing, setPlacing] = useState(false);
  const { data: gamesData } = useQuery<{ games: QuickGame[] }>({
    queryKey: ['games', 'live-quick'],
    queryFn: async () => { const r = await fetch('/api/games?status=live&limit=10'); if (!r.ok) return { games: [] }; return r.json(); },
    refetchInterval: 30_000,
  });
  const liveGames = gamesData?.games ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const game = liveGames.find((g) => g.id === selectedId) ?? liveGames[0] ?? null;
  useEffect(() => {
    if (liveGames.length === 0) return;
    const match = streamSport ? liveGames.find((g) => g.sport.toLowerCase() === streamSport.toLowerCase()) : null;
    setSelectedId((match ?? liveGames[0]).id);
    setOutcome(null);
  }, [liveGames, streamSport]);

  const placeBet = async () => {
    if (!game || !outcome || !stake || placing) return;
    const stakeNum = parseFloat(stake);
    if (isNaN(stakeNum) || stakeNum <= 0) { toast.error('Enter a valid stake amount'); return; }
    setPlacing(true);
    try {
      const r = await fetch('/api/bets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId: game.id, outcome, stake: stakeNum.toFixed(2) }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
      toast.success('Prediction placed! 🎯');
      setStake(''); setOutcome(null);
      qc.invalidateQueries({ queryKey: ['wallet'] });
    } catch (e: any) { toast.error(e.message || 'Failed to place prediction'); } finally { setPlacing(false); }
  };

  if (!liveGames.length) return null;
  return (
    <div className="rounded-lg border border-amber-500/20 bg-slate-900 overflow-hidden shrink-0">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-slate-800 bg-amber-500/5">
        <Swords className="h-3 w-3 text-amber-400" />
        <span className="text-xs font-semibold text-white">Quick Predict</span>
        <span className="ml-auto text-[9px] text-amber-400/50 font-mono">P2P · 10% fee</span>
      </div>
      <div className="p-2 space-y-1.5">
        {liveGames.length > 1 && (
          <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:ring-1 focus:ring-amber-500/40"
            value={selectedId ?? ''} onChange={(e) => { setSelectedId(Number(e.target.value)); setOutcome(null); }}>
            {liveGames.map((g) => <option key={g.id} value={g.id}>{g.playerA} vs {g.playerB}</option>)}
          </select>
        )}
        {game && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center">
              {(['player_a_wins', 'player_b_wins'] as const).reduce<React.ReactNode[]>((acc, o, i) => {
                const isA = o === 'player_a_wins';
                const label = isA ? game.playerA : game.playerB;
                const active = outcome === o;
                if (i === 1) acc.push(<span key="vs" className="text-[9px] font-bold text-slate-600 uppercase tracking-wider text-center">VS</span>);
                acc.push(
                  <button key={o} onClick={() => setOutcome(o)}
                    className={`flex items-center justify-center rounded-lg border px-1.5 py-1.5 text-center transition-all ${active ? 'border-teal-500 bg-teal-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                    <span className={`text-[11px] font-semibold leading-tight line-clamp-1 ${active ? 'text-teal-300' : 'text-white'}`}>{label}</span>
                  </button>
                );
                return acc;
              }, [])}
            </div>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">$</span>
                <input type="number" min="0.50" step="0.50" placeholder="0.00" value={stake}
                  onChange={(e) => setStake(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && placeBet()}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-2 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-amber-500/40 font-mono" />
              </div>
              <button onClick={placeBet} disabled={placing || !outcome || !stake || parseFloat(stake) <= 0}
                className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-3 py-1.5 transition-colors shrink-0">
                {placing ? <span className="h-3 w-3 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" /> : <><Swords className="h-3 w-3" /> Predict</>}
              </button>
            </div>
            <p className="text-center text-[9px] text-slate-600">{game.openBetsCount} open · ${parseFloat(game.totalBetPool || '0').toFixed(2)} pool</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Upcoming schedule ────────────────────────────────────────────────────────

function UpcomingRow({ ev }: { ev: UpcomingStream }) {
  const cd = useCountdown(ev.startTime);
  const label = cd ? cd.days > 0 ? `${cd.days}d ${cd.hours}h` : cd.hours > 0 ? `${cd.hours}h ${String(cd.minutes).padStart(2, '0')}m` : `${cd.minutes}m ${String(cd.seconds).padStart(2, '0')}s` : null;
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
        {label && <p className="text-teal-400 font-mono text-[11px] mt-0.5 flex items-center justify-end gap-1"><Timer className="h-3 w-3" />in {label}</p>}
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
      <div className="space-y-0">{upcoming.slice(0, 3).map((ev) => <UpcomingRow key={ev.id} ev={ev} />)}</div>
      <Link href="/upcoming" className="text-teal-400 hover:text-teal-300 text-xs mt-3 inline-block transition-colors">View full schedule →</Link>
    </div>
  );
}

// ─── Main parameterised component ────────────────────────────────────────────

const CHANNEL_META = {
  1: { title: 'Watch Live Now',  path: '/live',   label: 'Livestream'   },
  2: { title: 'Livestream 2',    path: '/live-2',  label: 'Livestream 2' },
  3: { title: 'Livestream 3',    path: '/live-3',  label: 'Livestream 3' },
};

export function ChannelLivePage({ channel }: { channel: 1 | 2 | 3 }) {
  const meta = CHANNEL_META[channel];
  const prefix = channel === 1 ? '' : `ch${channel}_`;

  useSEO({
    title: meta.title,
    path: meta.path,
    description: `Watch live sports streaming on ATA Sports Live. Access HD streams from your wallet.`,
    jsonLd: makeBreadcrumb([
      { name: 'Home', url: SITE_URL },
      { name: meta.label, url: `${SITE_URL}${meta.path}` },
    ]),
  });

  const { isAuthenticated } = useAuth();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || (user?.role as string) === 'manager';
  const qc = useQueryClient();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [liveViewerCount, setLiveViewerCount] = useState(0);
  const handleReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const x = 8 + Math.random() * 60;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
  }, []);

  // ── DB stream (channel 1 only) ──────────────────────────────────────────
  const { data: stream, isLoading: loadingStream } = useQuery<Stream | null>({
    queryKey: ['streams', 'live', 'current', channel],
    queryFn: async () => {
      if (channel !== 1) return null;
      const r = await fetch('/api/streams?status=live&limit=1');
      const data = await r.json();
      return data.streams?.[0] ?? null;
    },
    refetchInterval: 30000,
  });

  const { data: settings, isLoading: loadingSettings } = useGlobalSettings();
  const s = settings ?? {};

  // ── Settings derivation ─────────────────────────────────────────────────
  const liveStreamUrl = channel === 1 ? (s.liveStreamUrl ?? '') : '';
  const muxPlaybackId = s[`${prefix}mux_playback_id`] || (channel === 1 ? FALLBACK_MUX_PLAYBACK_ID : '');
  const muxIsLive     = s[`${prefix}mux_is_live`] === 'true';
  const muxIsFree     = s[`${prefix}mux_is_free`] === 'true';
  const muxPrice      = parseFloat(s[`${prefix}mux_price`] ?? '1.50');
  const muxTitle      = s[`${prefix}mux_title`] || 'ATA Live Stream';
  const muxStreamDbId = s[`${prefix}mux_stream_db_id`] ? Number(s[`${prefix}mux_stream_db_id`]) : undefined;

  const ytVideoId    = s[`${prefix}yt_video_id`] ?? '';
  const ytIsLive     = s[`${prefix}yt_is_live`] === 'true';
  const ytIsFree     = s[`${prefix}yt_is_free`] === 'true';
  const ytPrice      = parseFloat(s[`${prefix}yt_price`] ?? '1.50');
  const ytTitle      = s[`${prefix}yt_title`] || 'ATA Live Stream';
  const ytStreamDbId = s[`${prefix}yt_stream_db_id`] ? Number(s[`${prefix}yt_stream_db_id`]) : undefined;

  const subPrices = {
    daily:   parseFloat(s.price_daily   ?? '1.70'),
    weekly:  parseFloat(s.price_weekly  ?? '7.00'),
    monthly: parseFloat(s.price_monthly ?? '20.00'),
    yearly:  parseFloat(s.price_yearly  ?? '99.00'),
  };

  // ── Mux auto-probe ──────────────────────────────────────────────────────
  const probeEndpoint = channel === 1 ? '/api/settings/mux-probe' : `/api/settings/ch${channel}-mux-probe`;
  useQuery({
    queryKey: [`mux-probe-ch${channel}`],
    queryFn: async () => {
      const r = await fetch(probeEndpoint, { method: 'POST' });
      const d = await r.json();
      if (d.changed) {
        qc.invalidateQueries({ queryKey: ['settings'] });
        qc.invalidateQueries({ queryKey: ['streams'] });
      }
      return d;
    },
    enabled: muxIsLive,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  // ── Feed resolution ─────────────────────────────────────────────────────
  const isAnythingLive = channel === 1 ? (!!stream || muxIsLive || ytIsLive) : (muxIsLive || ytIsLive);
  const activeFeed: 'db' | 'mux' | 'yt' | null = (channel === 1 && stream) ? 'db' : muxIsLive ? 'mux' : ytIsLive ? 'yt' : null;

  const paywallStreamId: number | undefined =
    activeFeed === 'db'  ? stream!.id :
    activeFeed === 'mux' && !muxIsFree ? muxStreamDbId :
    activeFeed === 'yt'  && !ytIsFree  ? ytStreamDbId  :
    undefined;

  // chatStreamId is separate from paywallStreamId — chat always works regardless of paywall.
  const chatStreamId: number | undefined =
    activeFeed === 'db'  ? stream?.id :
    activeFeed === 'mux' ? muxStreamDbId :
    activeFeed === 'yt'  ? ytStreamDbId  :
    muxStreamDbId ?? ytStreamDbId;

  // ── Live viewer count polling (admin fallback + initial load) ────────────
  // Primary source: WebSocket `viewer_count` pushed on every connect/disconnect.
  // This REST poll gives the initial count before the first WS event fires.
  const { data: viewersData } = useQuery<{ count: number }>({
    queryKey: ['stream-viewers', chatStreamId],
    queryFn: async () => {
      const r = await fetch(`/api/streams/${chatStreamId}/viewers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    enabled: isAdmin && !!chatStreamId,
    refetchInterval: 10_000,
  });
  // Sync viewer count from poll — must be in useEffect, NOT in select, because
  // select runs during render and calling setState there causes infinite re-renders.
  useEffect(() => {
    if (viewersData?.count !== undefined) {
      setLiveViewerCount(viewersData.count);
    }
  }, [viewersData]);

  const paywallPrice = activeFeed === 'db' ? stream!.accessPrice : activeFeed === 'yt' ? ytPrice : muxPrice;
  const paywallTitle = activeFeed === 'db' ? stream!.title : activeFeed === 'yt' ? ytTitle : muxTitle;
  const isFreeStream = activeFeed === 'db' ? false : activeFeed === 'yt' ? ytIsFree : muxIsFree;

  // ── Access check ────────────────────────────────────────────────────────
  const { data: access, isLoading: loadingAccess } = useStreamAccess(
    isAuthenticated && paywallStreamId ? paywallStreamId : undefined
  );
  const isLoading = loadingStream || loadingSettings || (isAuthenticated && !!paywallStreamId && loadingAccess);
  const canWatch = isAuthenticated && (isFreeStream || access?.hasAccess === true || isManager);

  // ── Sneak peek ──────────────────────────────────────────────────────────
  const peekKey = `sneak_used_ch${channel}_${paywallStreamId ?? 'mux'}`;
  const sneakPeek = useSneakPeek(peekKey);

  const [selectedSubType, setSelectedSubType] = useState<'daily'|'weekly'|'monthly'|'yearly'>('daily');

  // ── Purchase ────────────────────────────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async ({ streamId, subscriptionType }: { streamId: number; subscriptionType: string }) => {
      const r = await fetch(`/api/streams/${streamId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ streamId, subscriptionType }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Purchase failed'); }
      return r.json();
    },
    onSuccess: () => {
      toast.success('Access granted! Enjoy the live broadcast.');
      qc.invalidateQueries({ queryKey: ['streams', paywallStreamId, 'access'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => toast.error(e.message || 'Purchase failed — check your wallet balance'),
  });

  const ytIdValid = /^[a-zA-Z0-9_-]{11}$/.test(ytVideoId);
  const hlsUrlValid = !!liveStreamUrl && !liveStreamUrl.includes('youtube.com') && !liveStreamUrl.includes('youtu.be');

  const playerEl =
    activeFeed === 'yt' && ytIdValid      ? <YouTubePlayer videoId={ytVideoId} title={paywallTitle} /> :
    activeFeed === 'yt' && !ytIdValid     ? <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Stream configuration invalid — check admin settings.</div> :
    activeFeed === null && hlsUrlValid    ? <HlsPlayer hlsUrl={liveStreamUrl} title={stream?.title ?? paywallTitle} /> :
    <MuxPlayer playbackId={muxPlaybackId} title={stream?.title ?? paywallTitle} />;

  const sidebar = (
    <div className="w-full lg:w-[260px] shrink-0 flex flex-col gap-2 h-full min-h-0">
      {isAuthenticated && <QuickBetPanel token={token} streamSport={stream?.sport ?? s[`${prefix}mux_sport`]} />}
      <div className="flex-1 min-h-0 max-h-[420px] lg:max-h-[460px] flex flex-col overflow-hidden">
        <CommentSection streamId={chatStreamId} token={token} userId={user?.id} isAuthenticated={isAuthenticated} onReaction={handleReaction} onViewerCount={isAdmin ? setLiveViewerCount : undefined} />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto min-w-0">
      {isLoading ? (
        <Skeleton className="w-full aspect-video rounded-xl bg-slate-800" />
      ) : !isAnythingLive ? (
        <NoLiveBroadcast channelLabel={meta.label} />
      ) : canWatch ? (
        <div className="space-y-3">
          <div className={`grid grid-cols-1 gap-3 ${sidebarOpen ? 'lg:grid-cols-[1fr_260px]' : ''}`}>
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
              {playerEl}
              <FloatingReactionsLayer reactions={floatingReactions} />
            </div>
            {sidebarOpen && (
              <div className="h-[340px] lg:h-full flex flex-col overflow-hidden">{sidebar}</div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
                </span>
                {stream?.sport && <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{stream.sport}</span>}
                {(stream?.city || stream?.country) && <span className="text-xs text-slate-600">· {[stream?.city, stream?.country].filter(Boolean).join(', ')}</span>}
                {isFreeStream && <span className="text-xs text-emerald-400 font-semibold">FREE</span>}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white">{stream?.title ?? paywallTitle}</h1>
              {stream?.description && <p className="text-slate-400 text-sm mt-1 max-w-2xl">{stream.description}</p>}
              {access?.expiresAt && <p className="text-slate-500 text-xs mt-1 flex items-center gap-1"><Lock className="h-3 w-3" />Access expires {new Date(access.expiresAt).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ReactionBar streamId={paywallStreamId} token={token} isAuthenticated={isAuthenticated} />
              {isAdmin && <div className="flex items-center gap-1.5 text-slate-400 text-sm"><Users className="h-4 w-4 text-teal-500" /><span className="font-mono text-white">{liveViewerCount}</span><span className="text-slate-500">watching</span></div>}
              <button onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? 'Hide panel' : 'Show chat'}
                className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white transition-colors">
                {sidebarOpen ? <><PanelRightClose className="h-3.5 w-3.5" /> Hide panel</> : <><PanelRightOpen className="h-3.5 w-3.5" /> Chat &amp; Activity</>}
              </button>
            </div>
          </div>
        </div>
      ) : sneakPeek.active ? (
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 min-w-0 space-y-3">
            <SneakPeekPlayer secondsLeft={sneakPeek.secondsLeft} onSkip={sneakPeek.skip} isAuthenticated={isAuthenticated}>
              {playerEl}
            </SneakPeekPlayer>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
              </span>
              <h1 className="text-lg font-bold text-white">{stream?.title ?? paywallTitle}</h1>
            </div>
          </div>
          <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0">
            <CommentSection streamId={chatStreamId} token={token} userId={user?.id} isAuthenticated={isAuthenticated} onReaction={handleReaction} onViewerCount={isAdmin ? setLiveViewerCount : undefined} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <StreamGate
            title={paywallTitle}
            description={stream?.description}
            sport={stream?.sport}
            thumbnailUrl={stream?.thumbnailUrl ?? (s[`${prefix}mux_thumbnail_url`] || s[`${prefix}yt_thumbnail_url`] || null)}
            prices={subPrices}
            selectedSubType={selectedSubType}
            onSelectSubType={setSelectedSubType}
            isFree={isFreeStream}
            isAuthenticated={isAuthenticated}
            paywallStreamId={paywallStreamId}
            isPurchasing={purchaseMutation.isPending}
            onPurchase={() => paywallStreamId && purchaseMutation.mutate({ streamId: paywallStreamId, subscriptionType: selectedSubType })}
            canPreview={isAnythingLive}
            previewUsed={sneakPeek.used}
            onStartPreview={sneakPeek.start}
          />
          {channel === 1 && <UpcomingSchedule />}
        </div>
      )}
    </div>
  );
}
