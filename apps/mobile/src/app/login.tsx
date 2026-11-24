import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { PrimaryButton } from '@/components/ui';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const { signIn, biometricAvailable } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password, useBiometrics);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>ATA Sports Live</Text>
        <Text style={styles.subtitle}>Sign in with your web account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {biometricAvailable && (
          <Pressable onPress={() => setUseBiometrics((v) => !v)} style={styles.checkRow}>
            <View style={[styles.checkbox, useBiometrics && styles.checkboxOn]} />
            <Text style={styles.checkLabel}>Unlock with Face ID / fingerprint</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton title="Sign in" onPress={handleLogin} loading={loading} disabled={!email || !password} />
        <Pressable onPress={() => router.push('/forgot-password')} style={styles.link}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/register')} style={styles.link}>
          <Text style={styles.linkText}>Create an account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.md },
  logo: { width: 88, height: 88, alignSelf: 'center', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.hero, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, color: colors.text,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.muted },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { color: colors.text, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.sm },
  link: { alignSelf: 'center', paddingVertical: 4 },
  linkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
});
