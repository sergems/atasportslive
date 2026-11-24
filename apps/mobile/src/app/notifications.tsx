import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, ScreenHeader, SectionTitle } from '@/components/ui';
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
    <Screen scroll={false}>
      <ScreenHeader title="Notifications" />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  markAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
});
