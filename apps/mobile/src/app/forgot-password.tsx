import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const result = await api.forgotPassword(email.trim().toLowerCase());
      Alert.alert('Check your email', result.message ?? 'If the account exists, a reset link has been sent.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not send reset link', e instanceof Error ? e.message : 'Please try again later');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter the email on your ATA account and we will send you a reset link.</Text>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <PrimaryButton title="Send reset link" onPress={() => void submit()} loading={loading} disabled={!email.trim()} />
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>Back to sign in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.hero, fontWeight: '800' },
  subtitle: { color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 50, color: colors.text,
  },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
});
