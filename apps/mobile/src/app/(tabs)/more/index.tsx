import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { colors, fontSize, radius, spacing } from '@/theme';

const ITEMS = [
  { label: 'Dashboard', detail: 'Your activity at a glance', icon: 'grid-outline', route: '/(tabs)/more/dashboard' },
  { label: 'Subscription', detail: 'Plans and access', icon: 'card-outline', route: '/(tabs)/more/subscription' },
  { label: 'Fixtures', detail: 'Upcoming streams', icon: 'calendar-outline', route: '/(tabs)/more/fixtures' },
  { label: 'Highlights', detail: 'Watch recent moments', icon: 'play-circle-outline', route: '/(tabs)/more/highlights' },
  { label: 'Referrals', detail: 'Your code and commissions', icon: 'people-outline', route: '/(tabs)/more/referrals' },
  { label: 'Profile', detail: 'Account and verification', icon: 'person-outline', route: '/(tabs)/more/profile' },
] as const;

export default function MoreScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.fullName ?? 'A').charAt(0).toUpperCase()}</Text></View>
        <View style={styles.headText}>
          <Text style={styles.name}>{user?.fullName ?? 'ATA user'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>
      </View>

      <SectionTitle>More</SectionTitle>
      <View style={styles.menu}>
        {ITEMS.map((item) => (
          <Pressable key={item.label} onPress={() => router.push(item.route)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <Ionicons name={item.icon} size={22} color={colors.primary} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.rowDetail}>{item.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
        ])}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  headText: { flex: 1 },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  email: { color: colors.muted, fontSize: fontSize.sm, marginTop: 2 },
  menu: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  rowDetail: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  signOut: { padding: spacing.md, alignItems: 'center', borderRadius: radius.md, backgroundColor: '#450A0A', marginTop: spacing.md },
  signOutText: { color: colors.danger, fontWeight: '800' },
});
