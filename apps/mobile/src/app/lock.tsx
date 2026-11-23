import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/providers/auth-provider';
import { PrimaryButton } from '@/components/ui';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function LockScreen() {
  const { unlock, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setError(null);
    setLoading(true);
    try {
      await unlock();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlock');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Unlock ATA Sports Live with Face ID or your fingerprint.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton title="Unlock" onPress={handleUnlock} loading={loading} />
        <PrimaryButton title="Use email instead" onPress={signOut} tone="accent" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, gap: spacing.md },
  icon: { fontSize: 42, textAlign: 'center' },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
});
