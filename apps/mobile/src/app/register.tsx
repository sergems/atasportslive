import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryButton } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function RegisterScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        referralCode: ref || undefined,
      });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Watch live sport from anywhere.</Text>

        <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.muted} value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" value={username} onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={20} />
        <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor={colors.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Password (8+ characters)" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={colors.muted} secureTextEntry value={confirm} onChangeText={setConfirm} />

        {!!ref && <Text style={styles.referral}>Referral code: {ref}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton
          title="Create account"
          onPress={() => void handleRegister()}
          loading={loading}
          disabled={!fullName || !username || !email || !password || !confirm}
        />
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md, paddingTop: spacing.xxl },
  title: { color: colors.text, fontSize: fontSize.hero, fontWeight: '800' },
  subtitle: { color: colors.muted, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, color: colors.text,
  },
  referral: { color: colors.accent, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.sm },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
});
