import { useQuery } from '@tanstack/react-query';

export interface ChannelStatus {
  ch1Live: boolean;
  ch2Live: boolean;
  ch3Live: boolean;
  ch2Enabled: boolean;
  ch3Enabled: boolean;
}

/**
 * Shared live-channel status hook used by both the desktop Navbar and the
 * mobile bottom nav so "Livestream 2 / 3" show up consistently everywhere
 * once they go live, instead of only on desktop.
 */
export function useChannelStatus(): ChannelStatus {
  const { data } = useQuery<ChannelStatus>({
    queryKey: ['nav', 'channel-status'],
    queryFn: async () => {
      // Use the public settings endpoint — no auth required so all visitors
      // (including unauthenticated users) see the correct nav items.
      const [streamsRes, settingsRes] = await Promise.all([
        fetch('/api/streams?status=live&limit=1'),
        fetch('/api/settings/public'),
      ]);
      const streamsData  = await streamsRes.json();
      const settingsData = await settingsRes.json();
      const dbLive = (streamsData.streams?.length ?? 0) > 0;
      return {
        ch1Live: dbLive || settingsData?.mux_is_live === 'true' || settingsData?.yt_is_live === 'true',
        ch2Live: settingsData?.ch2_mux_is_live === 'true' || settingsData?.ch2_yt_is_live === 'true',
        ch3Live: settingsData?.ch3_mux_is_live === 'true' || settingsData?.ch3_yt_is_live === 'true',
        ch2Enabled: settingsData?.ch2_page_enabled === 'true',
        ch3Enabled: settingsData?.ch3_page_enabled === 'true',
      };
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  return data ?? { ch1Live: false, ch2Live: false, ch3Live: false, ch2Enabled: false, ch3Enabled: false };
}
