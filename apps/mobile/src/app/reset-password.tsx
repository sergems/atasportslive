import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password.length < 8) { Alert.alert('Password too short', 'Use at least 8 characters.'); return; }
    if (password !== confirm) { Alert.alert('Passwords do not match'); return; }
    setLoading(true);
    try {
      const result = await api.resetPassword(email.trim().toLowerCase(), token.trim(), password);
      Alert.alert('Password updated', result.message ?? 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (e) {
      Alert.alert('Could not reset password', e instanceof Error ? e.message : 'Please request a new link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>Paste the reset details from your email if they did not open automatically.</Text>
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Reset token" placeholderTextColor={colors.muted} autoCapitalize="none" value={token} onChangeText={setToken} />
        <TextInput style={styles.input} placeholder="New password" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={colors.muted} secureTextEntry value={confirm} onChangeText={setConfirm} />
        <PrimaryButton title="Set new password" onPress={() => void submit()} loading={loading} disabled={!email || !token || !password || !confirm} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md, paddingTop: spacing.xxl },
  title: { color: colors.text, fontSize: fontSize.hero, fontWeight: '800' },
  subtitle: { color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, color: colors.text,
  },
});
