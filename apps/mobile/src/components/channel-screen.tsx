import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as SecureStore from 'expo-secure-store';
import { CloudflarePlayer, YouTubePlayer } from '@/components/video-players';
import { ChatPanel } from '@/components/chat-panel';
import { useLandscapeOnFocus } from '@/hooks/use-landscape-on-focus';
import { useChannelStatus } from '@/hooks/use-channel-status';
import { api } from '@/lib/api';
import { cfHlsUrl } from '@/lib/cloudflare';
import { colors, fontSize, spacing } from '@/theme';

export function ChannelScreen({ channel }: { channel: 1 | 2 | 3 }) {
  const prefix = channel === 1 ? '' : `ch${channel}_`;
  const channelTitle = channel === 1 ? 'ATA Sports Live' : `Live ${channel}`;
  const status = useChannelStatus();
  const live = channel === 1 ? status.ch1Live : channel === 2 ? status.ch2Live : status.ch3Live;
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [startAt, setStartAt] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  useLandscapeOnFocus();

  useEffect(() => {
    let active = true;
    void api.publicSettings().then((s) => { if (active) setSettings(s); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const ytId = settings[`${prefix}yt_video_id`] ?? '';
  const ytLive = settings[`${prefix}yt_is_live`] === 'true';
  const cfUid = settings[`${prefix}cf_playback_id`] ?? '';
  const cfLive = settings[`${prefix}cf_is_live`] === 'true';
  const hls = cfLive && cfUid ? cfHlsUrl(cfUid, settings[`${prefix}cf_hls_url`]) : '';
  // Chat uses the linked DB stream id so it works for free and paid streams.
  const chatStreamId = Number(settings[`${prefix}cf_stream_db_id`] || settings[`${prefix}yt_stream_db_id`] || 0) || undefined;

  useEffect(() => {
    if (!ytLive && ytId) {
      void SecureStore.getItemAsync(`ata_yt_pos_${ytId}`).then((v) => setStartAt(Number(v) || 0));
    }
  }, [ytLive, ytId]);

  if (!live) {
    return (
      <View style={styles.empty}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>{channel === 1 ? 'Live' : `Live ${channel}`}</Text>
        <Text style={styles.message}>No broadcast on this channel right now.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.player}>
        {ytLive && ytId ? (
          <YouTubePlayer videoId={ytId} live startAt={0} title={channelTitle} onChat={() => setChatOpen(true)} />
        ) : hls ? (
          <CloudflarePlayer uri={hls} title={channelTitle} onChat={() => setChatOpen(true)} />
        ) : ytId ? (
          <YouTubePlayer videoId={ytId} live={false} startAt={startAt} title={channelTitle} onChat={() => setChatOpen(true)} />
        ) : (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.message}>Connecting to the live feed…</Text>
          </View>
        )}
      </View>
      <ChatPanel streamId={chatStreamId} visible={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  logo: { width: 84, height: 84 },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  message: { color: colors.muted, fontSize: fontSize.sm, textAlign: 'center' },
});
