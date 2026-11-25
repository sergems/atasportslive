import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Card, ScreenHeader, Screen, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, fontSize, spacing } from '@/theme';

type Highlight = {
  id: number;
  title: string;
  description: string | null;
  youtubeUrl: string;
  createdAt: string;
};

export default function HighlightsScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['highlights'],
    queryFn: () => api.highlights(),
    staleTime: 60_000,
  });

  const open = (url: string) => {
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen>
      <ScreenHeader title="Highlights" />
      <SectionTitle>Latest highlights</SectionTitle>

      {isLoading && <ActivityIndicator color={colors.primary} />}
      {isError && (
        <Card>
          <Text style={styles.hint}>Could not load highlights. Check your connection and try again.</Text>
          <Pressable onPress={() => void refetch()}><Text style={styles.link}>Try again</Text></Pressable>
        </Card>
      )}
      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <Card><Text style={styles.hint}>No highlights published yet.</Text></Card>
      )}

      {(data ?? []).map((h: Highlight) => (
        <Card key={h.id} style={styles.item}>
          <Pressable onPress={() => open(h.youtubeUrl)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.play}><Ionicons name="play" size={18} color={colors.onPrimary} /></View>
            <View style={styles.text}>
              <Text style={styles.title}>{h.title}</Text>
              {!!h.description && <Text style={styles.hint}>{h.description}</Text>}
              <Text style={styles.date}>{new Date(h.createdAt).toLocaleDateString()}</Text>
            </View>
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowPressed: { opacity: 0.75 },
  play: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 18 },
  date: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  link: { color: colors.primary, textDecorationLine: 'underline', marginTop: spacing.sm },
});
