import { useQuery } from '@tanstack/react-query';

interface AdSlotData { image: string; link: string; enabled: boolean; }
interface AdSlotsResult {
  left_1: AdSlotData; left_2: AdSlotData; left_3: AdSlotData;
  right_1: AdSlotData; right_2: AdSlotData; right_3: AdSlotData;
  hideOnMobile: boolean;
}

export function useAdSlots(): AdSlotsResult {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['ad-slots'],
    queryFn: () => fetch('/api/settings/public').then((r) => r.json()),
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
