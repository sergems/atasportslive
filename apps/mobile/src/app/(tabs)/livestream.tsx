import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card, Screen, SectionTitle } from '@/components/ui';
import { StreamCard } from '@/components/stream-card';
import { api, type StreamItem } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

type Countdown = { days: number; hours: number; minutes: number; seconds: number };

/** Mirrors the website's one-second live countdown. */
function useCountdown(targetIso?: string): Countdown | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  if (!targetIso) return null;
  const diff = Math.floor((new Date(targetIso).getTime() - now) / 1000);
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
  };
}

function CountdownBlock({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.countBlock}>
      <Text style={styles.countValue}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

function CountdownTimer({ targetIso }: { targetIso?: string }) {
  const cd = useCountdown(targetIso);
  if (!cd) return null;
  return (
    <View style={styles.countdown}>
      {cd.days > 0 && <>
        <CountdownBlock label="days" value={cd.days} />
        <Text style={styles.colon}>:</Text>
      </>}
      <CountdownBlock label="hrs" value={cd.hours} />
      <Text style={styles.colon}>:</Text>
      <CountdownBlock label="min" value={cd.minutes} />
      <Text style={styles.colon}>:</Text>
      <CountdownBlock label="sec" value={cd.seconds} />
    </View>
  );
}

const when = (iso?: string) => {
  if (!iso) return 'Date to be announced';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Date to be announced'
    : d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Shown in place of the Live / Live 2 / Live 3 tabs while nothing is on air. */
export default function LivestreamScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['livestream-upcoming'],
    queryFn: () => api.upcoming(),
    refetchInterval: 30_000,
  });
  const events = (data ?? []).filter((s: StreamItem) => s.status === 'upcoming');
  const next = events[0];

  return (
    <Screen>
      <SectionTitle>Livestream</SectionTitle>

      <Card style={styles.offline}>
        <View style={styles.iconWrap}>
          <Ionicons name="radio-outline" size={26} color={colors.muted} />
        </View>
        <Text style={styles.title}>No Live Broadcast</Text>
        <Text style={styles.hint}>All ATA channels are off air right now.</Text>

        {next ? (
          <View style={styles.nextWrap}>
            <Text style={styles.nextLabel}>NEXT UP</Text>
            <Text style={styles.nextTitle} numberOfLines={2}>{next.title}</Text>
            <Text style={styles.nextDate}>{when(next.startTime)}</Text>
            <View style={styles.startsIn}>
              <Ionicons name="timer-outline" size={13} color={colors.primary} />
              <Text style={styles.startsInLabel}>STARTS IN</Text>
            </View>
            <CountdownTimer targetIso={next.startTime} />
          </View>
        ) : (
          <Text style={styles.hint}>No upcoming event scheduled yet.</Text>
        )}
      </Card>

      <SectionTitle>Upcoming events</SectionTitle>
      {isLoading && <ActivityIndicator color={colors.primary} />}
      {!isLoading && events.length === 0 && (
        <Card><Text style={styles.hint}>No upcoming events at the moment.</Text></Card>
      )}
      {events.map((s) => <StreamCard key={s.id} stream={s} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  offline: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  iconWrap: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' },
  hint: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 19, textAlign: 'center' },
  nextWrap: { width: '100%', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  nextLabel: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  nextTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  nextDate: { color: colors.accent, fontSize: fontSize.xs, fontFamily: 'monospace' },
  startsIn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  startsInLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  countdown: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  countBlock: { alignItems: 'center', minWidth: 40 },
  countValue: { color: colors.white, fontSize: fontSize.xl, fontWeight: '800', fontFamily: 'monospace' },
  countLabel: { color: colors.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  colon: { color: colors.muted, fontSize: fontSize.lg, fontWeight: '800', lineHeight: 30 },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
});
