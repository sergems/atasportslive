import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SectionTitle } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const iconFor = (type: string) => {
  if (type.includes('withdraw')) return 'cash-outline';
  if (type.includes('deposit') || type.includes('payment')) return 'wallet-outline';
  if (type.includes('stream') || type.includes('live')) return 'radio-outline';
  if (type.includes('bet') || type.includes('game')) return 'trophy-outline';
  return 'notifications-outline';
};

const MENU = [
  { label: 'Home', icon: 'home-outline', href: '/(tabs)/' },
  { label: 'Wallet', icon: 'wallet-outline', href: '/(tabs)/wallet' },
  { label: 'More', icon: 'menu-outline', href: '/(tabs)/more' },
] as const;

export default function NotificationsScreen() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notification-list'],
    queryFn: () => authedFetch((token) => api.notificationsList(token, 1, 50)),
  });

  // This screen is only mounted while open, so refetch on mount.
  useEffect(() => { void refetch(); }, [refetch]);

  const open = async (id: number) => {
    try {
      await authedFetch((token) => api.markNotificationRead(token, id));
      await queryClient.invalidateQueries({ queryKey: ['notification-list'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* read state is cosmetic — keep the list usable */ }
  };

  const markAll = async () => {
    try {
      await authedFetch((token) => api.markAllNotificationsRead(token));
      await queryClient.invalidateQueries({ queryKey: ['notification-list'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch { /* ignore */ }
  };

  const items = data?.notifications ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable onPress={() => router.push('/(tabs)/more')} hitSlop={10} accessibilityLabel="Open menu">
          <Ionicons name="menu-outline" size={23} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.head}>
        <SectionTitle>{data?.unreadCount ? `${data.unreadCount} unread` : 'All caught up'}</SectionTitle>
        {!!data?.unreadCount && (
          <Pressable onPress={() => void markAll()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => void open(item.id)} style={[styles.row, !item.read && styles.rowUnread]}>
              <View style={styles.iconWrap}>
                <Ionicons name={iconFor(item.type) as never} size={20} color={item.read ? colors.muted : colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
        />
      )}

      <View style={styles.menu}>
        {MENU.map((item) => (
          <Pressable key={item.label} onPress={() => router.push(item.href)} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
            <Ionicons name={item.icon} size={21} color={colors.primary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  markAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 100 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  rowUnread: { borderColor: colors.primary, backgroundColor: '#10282C' },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  rowBody: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  message: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 18 },
  time: { color: colors.muted, fontSize: fontSize.xs, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  empty: { color: colors.muted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: 48 },
  menu: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: spacing.sm, paddingBottom: spacing.md,
  },
  menuItem: { flex: 1, alignItems: 'center', gap: 3 },
  menuItemPressed: { opacity: 0.6 },
  menuLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
});

