import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VideoSize } from 'expo-video';
import { colors, fontSize, radius, spacing } from '@/theme';

export type QualityTier = 'auto' | '4k' | 'hd' | 'sd';

/** expo-video can cap the maximum adaptive resolution, but cannot lock a
 *  single rendition. Every tier below stays adaptive, like the website. */
export const MAX_RESOLUTION: Record<QualityTier, VideoSize | null> = {
  auto: null,
  '4k': { width: 3840, height: 2160 },
  hd: { width: 1920, height: 1080 },
  sd: { width: 1280, height: 720 },
};

export const QUALITY_LABEL: Record<QualityTier, string> = {
  auto: 'AUTO',
  '4k': '4K',
  hd: 'HD',
  sd: 'SD',
};

const OPTIONS: { tier: QualityTier; label: string; detail: string }[] = [
  { tier: 'auto', label: 'Auto · Best', detail: 'Adapts to your connection, up to 4K' },
  { tier: '4k', label: 'Auto · 4K', detail: 'Up to 2160p when your network allows' },
  { tier: 'hd', label: 'Auto · HD', detail: 'Up to 1080p · saves data' },
  { tier: 'sd', label: 'Auto · SD', detail: 'Up to 720p · best on slow networks' },
];

export function QualitySheet({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: QualityTier;
  onSelect: (tier: QualityTier) => void;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Video quality</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close quality menu">
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.tier}
              onPress={() => { onSelect(option.tier); onClose(); }}
              style={[styles.row, current === option.tier && styles.rowActive]}
            >
              <View style={styles.check}>
                {current === option.tier && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{option.label}</Text>
                <Text style={styles.rowDetail}>{option.detail}</Text>
              </View>
            </Pressable>
          ))}
          <Text style={styles.note}>Quality still changes automatically if your network speed drops or recovers.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'center', alignItems: 'center' },
  panel: {
    width: '90%', maxWidth: 420, backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  rowActive: { backgroundColor: '#0F3D3A' },
  check: { width: 18, alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: fontSize.xs },
  note: { color: colors.muted, fontSize: fontSize.xs, marginTop: spacing.md, lineHeight: 16 },
});
