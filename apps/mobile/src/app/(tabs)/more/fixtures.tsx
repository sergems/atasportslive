import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, ScreenHeader, Screen, SectionTitle } from '@/components/ui';
import { api, type StreamItem } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const dayLabel = (iso?: string) => {
  if (!iso) return 'Date to be announced';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Date to be announced'
    : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
};

const timeLabel = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

function countdown(seconds = 0) {
  if (seconds <= 0) return 'Starting soon';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) return `In ${Math.floor(h / 24)} day${Math.floor(h / 24) === 1 ? '' : 's'}`;
  return h > 0 ? `In ${h}h ${m}m` : `In ${m}m`;
}

/** Upcoming streams only — games and betting are browser-only. */
export default function FixturesScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fixtures-streams'],
    queryFn: () => api.upcoming(),
    refetchInterval: 60_000,
  });

  const streams = (data ?? []).filter((s: StreamItem) => s.status === 'upcoming');
  const groups = streams.reduce<Record<string, StreamItem[]>>((acc, s) => {
    const key = dayLabel(s.startTime);
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Screen>
      <ScreenHeader title="Fixtures" />
      <SectionTitle>Upcoming streams</SectionTitle>

      {isLoading && <ActivityIndicator color={colors.primary} />}
      {isError && (
        <Card>
          <Text style={styles.hint}>Could not load fixtures. Check your connection and try again.</Text>
          <Pressable onPress={() => void refetch()}><Text style={styles.link}>Try again</Text></Pressable>
        </Card>
      )}
      {!isLoading && !isError && streams.length === 0 && (
        <Card><Text style={styles.hint}>No upcoming streams scheduled right now.</Text></Card>
      )}

      {Object.entries(groups).map(([day, items]) => (
        <View key={day} style={styles.group}>
          <Text style={styles.day}>{day}</Text>
          {items.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/player/${s.id}`)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={styles.rowTop}>
                <Text style={styles.sport}>{(s.sport ?? 'event').toUpperCase()}</Text>
                <Text style={styles.time}>{timeLabel(s.startTime)}</Text>
              </View>
              <Text style={styles.title}>{s.playerA && s.playerB ? `${s.playerA} vs ${s.playerB}` : s.title}</Text>
              <Text style={styles.hint}>
                {[s.city, s.country].filter(Boolean).join(', ') || s.title}
              </Text>
              <Text style={styles.countdown}>{countdown(s.secondsUntilStart)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm, marginBottom: spacing.md },
  day: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.sm },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  sport: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '800' },
  time: { color: colors.muted, fontSize: fontSize.xs },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 19 },
  countdown: { color: colors.cash, fontSize: fontSize.xs, fontWeight: '700', marginTop: 2 },
  link: { color: colors.primary, textDecorationLine: 'underline', marginTop: spacing.sm },
});
