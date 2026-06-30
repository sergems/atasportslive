import React from 'react';
import { useQuery } from '@tanstack/react-query';

export interface AdSlotData {
  image: string;
  link: string;
  enabled: boolean;
}

export const FALLBACK_SLOTS: Record<string, { tagline: string; sub: string; cta: string; bg: string; badge: string; accent: string }> = {
  left_1:  { tagline: 'Your brand here',        sub: 'Reach thousands of sports fans across Uganda and Africa.',  cta: 'Advertise with us', bg: 'from-teal-900/80 via-slate-900 to-slate-950',    badge: 'bg-teal-500/20 text-teal-300',     accent: 'border-teal-500/20' },
  left_2:  { tagline: 'Power the game',          sub: 'Connect with passionate fans at every match and stream.',  cta: 'Get exposure',       bg: 'from-amber-900/60 via-slate-900 to-slate-950',   badge: 'bg-amber-500/20 text-amber-300',   accent: 'border-amber-500/20' },
  left_3:  { tagline: 'Grow with sports',        sub: "Sponsor Uganda's rising sports talent and events.",         cta: 'Become a sponsor',   bg: 'from-emerald-900/60 via-slate-900 to-slate-950', badge: 'bg-emerald-500/20 text-emerald-300', accent: 'border-emerald-500/20' },
  right_1: { tagline: 'Be seen. Be heard.',      sub: 'Premium placement next to live sports content.',           cta: 'Book a slot',        bg: 'from-violet-900/60 via-slate-900 to-slate-950',  badge: 'bg-violet-500/20 text-violet-300', accent: 'border-violet-500/20' },
  right_2: { tagline: 'Champion brands',         sub: "Align your brand with Uganda's top sporting moments.",     cta: 'Learn more',         bg: 'from-red-900/60 via-slate-900 to-slate-950',     badge: 'bg-red-500/20 text-red-300',       accent: 'border-red-500/20' },
  right_3: { tagline: 'Win with every match',    sub: 'Your message delivered to engaged sports fans daily.',     cta: 'Start today',        bg: 'from-blue-900/60 via-slate-900 to-slate-950',    badge: 'bg-blue-500/20 text-blue-300',     accent: 'border-blue-500/20' },
};

export interface AdSlotsResult extends Record<string, AdSlotData> {
  hideOnMobile: boolean;
}

export function useAdSlots(): AdSlotsResult {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['ad-slots'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const parse = (key: string): AdSlotData => ({
    image:   settings?.[`ad_slot_${key}_image`] ?? '',
    link:    settings?.[`ad_slot_${key}_link`] ?? '',
    enabled: settings?.[`ad_slot_${key}_enabled`] !== 'false',
  });

  return {
    left_1:  parse('left_1'),
    left_2:  parse('left_2'),
    left_3:  parse('left_3'),
    right_1: parse('right_1'),
    right_2: parse('right_2'),
    right_3: parse('right_3'),
    hideOnMobile: settings?.['ads_hide_on_mobile'] === 'true',
  };
}

export function AdCard({ slotKey, slot }: { slotKey: string; slot: AdSlotData }) {
  const fallback = FALLBACK_SLOTS[slotKey];
  if (!slot.enabled) return null;

  if (slot.image) {
    const inner = (
      <div className={`rounded-2xl border ${fallback.accent} overflow-hidden flex flex-col`}>
        <div className={`w-full py-1 text-[9px] font-bold tracking-widest uppercase text-center ${fallback.badge}`}>
          Advertisement
        </div>
        <img src={slot.image} alt="Advertisement" className="w-full object-cover flex-1" style={{ minHeight: 120 }} />
      </div>
    );
    if (slot.link) {
      return (
        <a href={slot.link} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
          {inner}
        </a>
      );
    }
    return inner;
  }

  return (
    <div className={`rounded-2xl border ${fallback.accent} bg-gradient-to-b ${fallback.bg} overflow-hidden flex flex-col items-center text-center`}>
      <div className={`w-full py-1 text-[9px] font-bold tracking-widest uppercase ${fallback.badge}`}>
        Advertisement
      </div>
      <div className="flex-1 flex flex-col items-center justify-between p-4 gap-4 min-h-[220px]">
        <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${fallback.badge}`}>
          SPONSOR
        </div>
        <div className="space-y-2">
          <div className="text-white font-bold text-sm leading-tight">{fallback.tagline}</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">{fallback.sub}</p>
        </div>
        <a
          href="mailto:info@atasportslive.com"
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
        >
          {fallback.cta} →
        </a>
      </div>
    </div>
  );
}

export function HorizontalAdBanner({ slotKey, slot }: { slotKey: string; slot: AdSlotData }) {
  const fallback = FALLBACK_SLOTS[slotKey];
  if (!slot.enabled) return null;

  if (slot.image) {
    const inner = (
      <div className={`rounded-xl border ${fallback.accent} overflow-hidden`}>
        <img src={slot.image} alt="Advertisement" className="w-full h-24 object-cover" />
      </div>
    );
    if (slot.link) {
      return (
        <a href={slot.link} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
          {inner}
        </a>
      );
    }
    return inner;
  }

  return (
    <div className={`rounded-xl border ${fallback.accent} bg-gradient-to-r ${fallback.bg} flex items-center gap-3 px-4 py-3`}>
      <div className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded ${fallback.badge}`}>
        AD
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-xs truncate">{fallback.tagline}</p>
        <p className="text-slate-400 text-[10px] truncate">{fallback.sub}</p>
      </div>
      <a
        href="mailto:info@atasportslive.com"
        className="shrink-0 text-[10px] font-semibold text-teal-400 hover:text-teal-300 transition-colors whitespace-nowrap"
      >
        {fallback.cta} →
      </a>
    </div>
  );
}
