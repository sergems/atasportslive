import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FALLBACK_SLOTS } from './constants';

export { FALLBACK_SLOTS } from './constants';

export interface AdSlotData {
  image: string;
  link: string;
  enabled: boolean;
}

export interface AdSlotsResult {
  left_1: AdSlotData;
  left_2: AdSlotData;
  left_3: AdSlotData;
  right_1: AdSlotData;
  right_2: AdSlotData;
  right_3: AdSlotData;
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
