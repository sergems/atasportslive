import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, fontSize, radius, spacing } from '@/theme';
import type { StreamItem } from '@/lib/api';
import { resolveAssetUrl } from '@/lib/api';

/** Display-only card. It never navigates, so it cannot trigger the player's landscape lock. */
export function StreamCard({ stream }: { stream: StreamItem }) {
  const live = stream.status === 'live';
  const thumb = resolveAssetUrl(stream.thumbnailUrl);
  return (
    <View style={styles.card}>
      <Image
        source={thumb ? { uri: thumb } : require('../../assets/icon.png')}
        style={styles.thumb}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.body}>
        <View style={styles.badges}>
          <View style={[styles.badge, live ? styles.liveBadge : styles.upcomingBadge]}>
            <Text style={[styles.badgeText, live ? styles.liveText : styles.upcomingText]}>
              {live ? '● LIVE' : stream.status.toUpperCase()}
            </Text>
          </View>
          {!!stream.sport && <Text style={styles.sport}>{stream.sport}</Text>}
        </View>
        <Text style={styles.title} numberOfLines={2}>{stream.title}</Text>
        <Text style={styles.footer}>
          {live ? `${stream.viewerCount ?? 0} watching` : `$${Number(stream.accessPrice ?? 0).toFixed(2)} access`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 116, height: 78, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  body: { flex: 1, gap: spacing.xs, justifyContent: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  liveBadge: { backgroundColor: '#450A0A' },
  upcomingBadge: { backgroundColor: colors.surfaceAlt },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  liveText: { color: colors.danger },
  upcomingText: { color: colors.muted },
  sport: { color: colors.muted, fontSize: fontSize.xs, textTransform: 'capitalize' },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  footer: { color: colors.primary, fontSize: fontSize.xs, marginTop: 2 },
});
