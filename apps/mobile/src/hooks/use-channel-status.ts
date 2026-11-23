import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChannelStatus {
  ch1Live: boolean;
  ch2Live: boolean;
  ch3Live: boolean;
  ch2Enabled: boolean;
  ch3Enabled: boolean;
}

const OFFLINE: ChannelStatus = {
  ch1Live: false, ch2Live: false, ch3Live: false, ch2Enabled: false, ch3Enabled: false,
};

/** Mirrors the website's hook: which live channels exist right now. */
export function useChannelStatus(): ChannelStatus {
  const { data } = useQuery<ChannelStatus>({
    queryKey: ['channel-status'],
    queryFn: async () => {
      const [settings, live] = await Promise.all([api.publicSettings(), api.liveStreams()]);
      const dbLive = (live.streams?.length ?? 0) > 0;
      return {
        ch1Live: dbLive || settings.mux_is_live === 'true' || settings.yt_is_live === 'true',
        ch2Live: settings.ch2_mux_is_live === 'true' || settings.ch2_yt_is_live === 'true',
        ch3Live: settings.ch3_mux_is_live === 'true' || settings.ch3_yt_is_live === 'true',
        ch2Enabled: settings.ch2_page_enabled === 'true',
        ch3Enabled: settings.ch3_page_enabled === 'true',
      };
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  return data ?? OFFLINE;
}
