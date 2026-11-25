import React from 'react';
import { Stack } from 'expo-router';

/** Nested stack inside the More tab — the outer bottom tab bar stays visible. */
export default function MoreLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ headerShown: false }} />
      <Stack.Screen name="fixtures" options={{ headerShown: false }} />
      <Stack.Screen name="highlights" options={{ headerShown: false }} />
      <Stack.Screen name="referrals" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}
