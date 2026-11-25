import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { CloudflarePlayer, YouTubePlayer } from '@/components/video-players';
import { ChatPanel } from '@/components/chat-panel';
import { useLandscapeOnFocus } from '@/hooks/use-landscape-on-focus';
import { api, type StreamItem, type AccessStatus } from '@/lib/api';
import { cfHlsUrl } from '@/lib/cloudflare';
import { useAuth } from '@/providers/auth-provider';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const streamId = Number(id);
  const { authedFetch } = useAuth();
  const [stream, setStream] = useState<StreamItem | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startAt, setStartAt] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [streamRes, settingsRes, accessRes] = await Promise.all([
        api.stream(streamId),
        api.publicSettings(),
        authedFetch((token) => api.accessCheck(streamId, token)),
      ]);
      setStream(streamRes);
      setSettings(settingsRes);
      setAccess(accessRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the stream');
    } finally {
      setLoading(false);
    }
  }, [streamId, authedFetch]);

  // Follow the video in landscape only while this player is on screen.
  useLandscapeOnFocus();

  // Data loading is async; the setState calls happen after the fetch resolves.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const ytLive = settings.yt_is_live === 'true';
  const ytId = settings.yt_video_id ?? '';
  const cfLive = settings.cf_is_live === 'true';
  const cfUid = settings.cf_playback_id ?? '';
  const hls = cfLive && cfUid
    ? cfHlsUrl(cfUid, settings.cf_hls_url)
    : stream?.hlsUrl ?? '';

  useEffect(() => {
    if (!ytLive && ytId) {
      void SecureStore.getItemAsync(`ata_yt_pos_${ytId}`).then((v) => setStartAt(Number(v) || 0));
    }
  }, [ytLive, ytId]);

  async function buy() {
    if (!access) return;
    setBuying(true);
    try {
      await authedFetch((token) => api.purchaseAccess(streamId, token, 'daily'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not purchase access');
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.button}><Text style={styles.buttonText}>Go back</Text></Pressable>
      </View>
    );
  }
  if (!access?.hasAccess) {
    return (
      <View style={styles.center}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>{stream?.title ?? 'Live event'}</Text>
        <Text style={styles.message}>Unlock this stream to watch live.</Text>
        <Text style={styles.price}>${Number(stream?.accessPrice ?? 1.5).toFixed(2)} / day</Text>
        <Pressable onPress={buy} disabled={buying} style={styles.button}>
          <Text style={styles.buttonText}>{buying ? 'Purchasing…' : 'Get access'}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Back</Text></Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={styles.player}>
        {ytLive && ytId ? (
          <YouTubePlayer videoId={ytId} live startAt={0} title={stream?.title} showBack onChat={() => setChatOpen(true)} />
        ) : hls ? (
          <CloudflarePlayer uri={hls} title={stream?.title} live={stream?.status === 'live'} showBack onChat={() => setChatOpen(true)} />
        ) : ytId ? (
          <YouTubePlayer videoId={ytId} live={false} startAt={startAt} title={stream?.title} showBack onChat={() => setChatOpen(true)} />
        ) : (
          <View style={styles.center}><Text style={styles.message}>This stream has no video feed configured yet.</Text></View>
        )}
      </View>
      <ChatPanel streamId={streamId} visible={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  logo: { width: 80, height: 80 },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.muted, fontSize: fontSize.sm, textAlign: 'center' },
  price: { color: colors.primary, fontSize: fontSize.xl, fontWeight: '800' },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  buttonText: { color: colors.onPrimary, fontWeight: '800' },
  link: { color: colors.muted, textDecorationLine: 'underline' },
});
