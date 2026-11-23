import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Check, ChevronDown, Settings2 } from 'lucide-react';

/** A user-facing quality choice. Auto tiers are ABR-cap ceilings, not fixed levels. */
export type QualityChoice =
  | { kind: 'auto'; capHeight: number | null }
  | { kind: 'fixed'; height: number };

interface LevelInfo {
  height: number;
  bitrate: number;
}

export interface QualityOption {
  id: string;
  label: string;
  detail: string;
  choice: QualityChoice;
}

const STORAGE_KEY = 'ata-player-quality';

function readStoredChoice(): QualityChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kind: 'auto', capHeight: null };
    const parsed = JSON.parse(raw) as QualityChoice;
    if (parsed?.kind === 'auto' && (parsed.capHeight === null || typeof parsed.capHeight === 'number')) {
      return parsed;
    }
    if (parsed?.kind === 'fixed' && typeof parsed.height === 'number') return parsed;
  } catch { /* ignore malformed preferences */ }
  return { kind: 'auto', capHeight: null };
}

function storeChoice(choice: QualityChoice) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(choice)); } catch { /* private mode */ }
}

function highestIndexAtOrBelow(levels: LevelInfo[], capHeight: number): number {
  let best = 0;
  let bestHeight = -1;
  let bestBitrate = -1;
  levels.forEach((level, index) => {
    if (level.height <= capHeight && (level.height > bestHeight || (level.height === bestHeight && level.bitrate > bestBitrate))) {
      best = index;
      bestHeight = level.height;
      bestBitrate = level.bitrate;
    }
  });
  return best;
}

function indexForHeight(levels: LevelInfo[], height: number): number {
  let best = -1;
  let bestBitrate = -1;
  levels.forEach((level, index) => {
    if (level.height === height && level.bitrate > bestBitrate) {
      best = index;
      bestBitrate = level.bitrate;
    }
  });
  if (best >= 0) return best;
  return highestIndexAtOrBelow(levels, height);
}

/** Apply a choice to an hls.js instance.
 *  Auto tiers keep ABR enabled and only cap the ceiling; fixed levels lock ABR. */
export function applyQualityChoice(hls: Hls, choice: QualityChoice, levels: LevelInfo[]) {
  if (!levels.length) return;
  if (choice.kind === 'auto') {
    // -1 clears any manual level so adaptive selection stays active.
    hls.nextLevel = -1;
    hls.autoLevelCapping = choice.capHeight === null ? -1 : highestIndexAtOrBelow(levels, choice.capHeight);
  } else {
    hls.autoLevelCapping = -1;
    // nextLevel switches at the next segment boundary rather than abruptly.
    hls.nextLevel = indexForHeight(levels, choice.height);
  }
}

function formatSpeed(bitrate: number): string {
  if (!bitrate) return '';
  const mbps = bitrate / 1_000_000;
  return `${mbps >= 10 ? mbps.toFixed(0) : mbps.toFixed(1)} Mbps`;
}

export function buildQualityOptions(levels: LevelInfo[]): QualityOption[] {
  const heights = Array.from(new Set(levels.map((l) => l.height).filter((h) => h > 0))).sort((a, b) => b - a);
  const max = heights[0] ?? 0;
  const options: QualityOption[] = [
    { id: 'auto-best', label: 'Auto · Best', detail: 'Adapts to your connection', choice: { kind: 'auto', capHeight: null } },
  ];
  if (max >= 2160) {
    options.push({ id: 'auto-4k', label: 'Auto · 4K', detail: 'Up to 2160p', choice: { kind: 'auto', capHeight: 2160 } });
  }
  if (max >= 1080) {
    options.push({ id: 'auto-hd', label: 'Auto · HD', detail: 'Up to 1080p', choice: { kind: 'auto', capHeight: 1080 } });
  }
  const sdCap = heights.includes(480) ? 480 : 720;
  if (max >= 480 && max !== sdCap) {
    options.push({ id: 'auto-sd', label: 'Auto · SD', detail: `Up to ${sdCap}p · data saver`, choice: { kind: 'auto', capHeight: sdCap } });
  }

  for (const height of heights) {
    const bitrate = Math.max(...levels.filter((l) => l.height === height).map((l) => l.bitrate));
    options.push({
      id: `fixed-${height}`,
      label: `${height}p`,
      detail: `Fixed${bitrate ? ` · ${formatSpeed(bitrate)}` : ''}`,
      choice: { kind: 'fixed', height },
    });
  }
  return options;
}

export function describeChoice(choice: QualityChoice): string {
  if (choice.kind === 'fixed') return `Fixed ${choice.height}p`;
  if (choice.capHeight === null) return 'Auto';
  if (choice.capHeight >= 2160) return 'Auto 4K';
  if (choice.capHeight >= 1080) return 'Auto HD';
  return 'Auto SD';
}

export function useHlsQuality(hls: Hls | null) {
  const [levels, setLevels] = useState<LevelInfo[]>([]);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [choice, setChoiceState] = useState<QualityChoice>(readStoredChoice);

  useEffect(() => {
    if (!hls) {
      setLevels([]);
      setCurrentHeight(null);
      return;
    }
    const onManifestParsed = () => {
      setLevels(hls.levels.map((level) => ({ height: level.height || 0, bitrate: level.bitrate || 0 })));
    };
    const onLevelSwitched = () => {
      const level = hls.levels[hls.currentLevel];
      setCurrentHeight(level?.height || null);
    };
    hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
    hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    if (hls.levels.length) onManifestParsed();
    return () => {
      hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
    };
  }, [hls]);

  // Re-apply after a source change (new levels) or when the user changes tier.
  useEffect(() => {
    if (hls && levels.length) applyQualityChoice(hls, choice, levels);
  }, [hls, levels, choice]);

  const setChoice = useCallback((next: QualityChoice) => {
    storeChoice(next);
    setChoiceState(next);
  }, []);

  const options = useMemo(() => buildQualityOptions(levels), [levels]);
  return { levels, currentHeight, choice, setChoice, options };
}

export function QualityMenu({
  hls,
  options,
  currentHeight,
  choice,
  onChange,
}: {
  hls: Hls | null;
  options: QualityOption[];
  currentHeight: number | null;
  choice: QualityChoice;
  onChange: (choice: QualityChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const autoOptions = options.filter((o) => o.choice.kind === 'auto');
  const fixedOptions = options.filter((o) => o.choice.kind === 'fixed');

  if (!hls) {
    return (
      <span
        title="This browser is playing HLS natively — quality adapts automatically"
        className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur-sm"
      >
        <Settings2 className="h-3.5 w-3.5" /> Auto
      </span>
    );
  }

  function selected(o: QualityOption) {
    if (o.choice.kind !== choice.kind) return false;
    if (o.choice.kind === 'auto') return o.choice.capHeight === (choice.kind === 'auto' ? choice.capHeight : undefined);
    return o.choice.height === (choice.kind === 'fixed' ? choice.height : undefined);
  }

  function renderOption(o: QualityOption) {
    return (
      <button
        key={o.id}
        onClick={() => { onChange(o.choice); setOpen(false); }}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
          selected(o) ? 'bg-teal-500/15 text-teal-300' : 'text-slate-200 hover:bg-white/10'
        }`}
      >
        <span className="flex w-4 shrink-0 justify-center">{selected(o) && <Check className="h-3.5 w-3.5" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold leading-tight">{o.label}</span>
          <span className="block truncate text-[10px] text-slate-500">{o.detail}</span>
        </span>
      </button>
    );
  }

  return (
    <div ref={rootRef} className="pointer-events-auto relative z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change video quality"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80"
      >
        <Settings2 className="h-3.5 w-3.5 text-teal-400" />
        <span>{describeChoice(choice)}</span>
        {currentHeight !== null && !(choice.kind === 'fixed' && currentHeight === choice.height) && (
          <span className="text-slate-400">· {currentHeight}p</span>
        )}
        <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-60 rounded-xl border border-slate-700 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur-md">
          <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Automatic · adapts to your network
          </p>
          {autoOptions.map(renderOption)}
          {fixedOptions.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-800" />
              <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                Fixed quality
              </p>
              {fixedOptions.map(renderOption)}
            </>
          )}
          <p className="px-2.5 pb-1 pt-2 text-[10px] leading-snug text-slate-600">
            Auto keeps playing smoothly if your connection drops, then climbs back up when it recovers.
          </p>
        </div>
      )}
    </div>
  );
}
