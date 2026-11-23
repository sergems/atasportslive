import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fontSize, radius, spacing } from '@/theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <View style={styles.screen}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">{content}</ScrollView> : content}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** Back button + title for standalone (non-tab) screens. */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.screenHeader}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton} accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.screenHeaderTitle}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading, tone = 'primary' }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'accent';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        tone === 'accent' ? styles.buttonAccent : styles.buttonPrimary,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function Money({ label, value, tone }: { label: string; value: number; tone: 'cash' | 'bonus' | 'neutral' }) {
  return (
    <Card style={styles.moneyCard}>
      <Text style={[styles.moneyValue, tone === 'cash' && { color: colors.cash }, tone === 'bonus' && { color: colors.bonus }]}>
        ${value.toFixed(2)}
      </Text>
      <Text style={styles.moneyLabel}>{label}</Text>
    </Card>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function TextField({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry,
  autoCapitalize = 'none', maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  );
}

export function SegmentedTabs({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.tabs}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.tab, value === o.value && styles.tabActive]}
        >
          <Text style={[styles.tabText, value === o.value && styles.tabTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: 90 },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  screenHeaderTitle: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center' },
  button: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonAccent: { backgroundColor: colors.accent },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  moneyCard: { flex: 1, minWidth: 140 },
  moneyValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  moneyLabel: { color: colors.muted, fontSize: fontSize.sm, marginTop: spacing.xs },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.text, fontSize: fontSize.md,
  },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontSize: fontSize.sm, fontWeight: '700' },
  tabTextActive: { color: colors.onPrimary },
});
