import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { PushProvider } from '@/providers/push-provider';
import { colors } from '@/theme';

// Keep the tab navigator as the base screen so login/lock present as modals.
export const unstable_settings = { anchor: '(tabs)' };

function RootNavigator() {
  const { status } = useAuth();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="lock" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
      </Stack>
      {status === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      {status === 'unauthenticated' && <Redirect href="/login" />}
      {status === 'locked' && <Redirect href="/lock" />}
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PushProvider>
          <RootNavigator />
        </PushProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
