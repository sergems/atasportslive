import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useChannelStatus } from '@/hooks/use-channel-status';
import { api, APP_ORIGIN } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const money = (v?: number) => `$${(v ?? 0).toFixed(2)}`;
const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

export default function DashboardScreen() {
  const { user, authedFetch } = useAuth();
  const { ch1Live } = useChannelStatus();

  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => authedFetch((t) => api.wallet(t)) });
  const { data: tx } = useQuery({ queryKey: ['wallet-transactions'], queryFn: () => authedFetch((t) => api.transactions(t, 5)) });
  const { data: live } = useQuery({ queryKey: ['dashboard-live'], queryFn: api.liveStreams, refetchInterval: 30_000 });
  const { data: notes } = useQuery({ queryKey: ['notifications'], queryFn: () => authedFetch((t) => api.notifications(t)), refetchInterval: 30_000 });

  const stats = [
    { label: 'Available', value: wallet?.availableBalance, tone: colors.text },
    { label: 'Bonus', value: wallet?.bonusBalance, tone: colors.bonus },
    { label: 'In play', value: wallet?.pendingBalance, tone: colors.accent },
    { label: 'Withdrawable', value: wallet?.withdrawableBalance, tone: colors.cash },
  ];

  return (
    <Screen>
      <ScreenHeader title="Dashboard" />
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{user?.fullName?.split(' ')[0] ?? 'there'}</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell}>
            <Ionicons name="notifications-outline" size={22} color={(notes?.unreadCount ?? 0) > 0 ? colors.accent : colors.muted} />
            {(notes?.unreadCount ?? 0) > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{notes!.unreadCount > 9 ? '9+' : notes!.unreadCount}</Text></View>}
          </Pressable>
        </View>
        <Text style={styles.balanceLabel}>Cash balance</Text>
        <Text style={styles.balance}>{money(wallet?.availableBalance)}</Text>
        {(wallet?.bonusBalance ?? 0) > 0 && <Text style={styles.bonusLine}>🎁 {money(wallet!.bonusBalance)} bonus</Text>}
        <Pressable onPress={() => router.push('/(tabs)/wallet')}><Text style={styles.link}>Manage wallet →</Text></Pressable>
        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={() => router.push('/(tabs)/wallet')}><Ionicons name="add-circle-outline" size={20} color={colors.primary} /><Text style={styles.actionText}>Deposit</Text></Pressable>
          <Pressable style={styles.action} onPress={() => router.push('/(tabs)/live')}><Ionicons name="play-circle-outline" size={20} color={colors.primary} /><Text style={styles.actionText}>Watch Live</Text></Pressable>
        </View>
      </View>

      {(ch1Live || (live?.streams?.length ?? 0) > 0) && (
        <Pressable style={styles.liveBanner} onPress={() => router.push('/(tabs)/live')}>
          <View style={styles.livePill}><Text style={styles.livePillText}>● LIVE NOW</Text></View>
          <Text style={styles.liveTitle} numberOfLines={1}>{live?.streams?.[0]?.title ?? 'ATA Sports Live'}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.white} />
        </Pressable>
      )}

      <SectionTitle>Your balance</SectionTitle>
      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}><Text style={[styles.statValue, { color: s.tone }]}>{money(s.value)}</Text><Text style={styles.statLabel}>{s.label}</Text></View>
        ))}
      </View>

      <SectionTitle>Recent transactions</SectionTitle>
      <Card>
        {(tx?.transactions?.length ?? 0) === 0
          ? <Text style={styles.hint}>No transactions yet.</Text>
          : tx!.transactions.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowMain}>{t.type.replace(/_/g, ' ')}</Text>
                <Text style={styles.rowSub}>{new Date(t.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.rowAmount}>{['deposit', 'bet_win', 'bet_refund', 'admin_credit'].includes(t.type) ? '+' : '−'}{money(Math.abs(t.amount))}</Text>
            </View>
          ))}
      </Card>

      {!!user?.referralCode && (
        <Card style={styles.referral}>
          <Text style={styles.rowMain}>Invite a friend — earn together</Text>
          <Text style={styles.referralLink} selectable>{APP_ORIGIN}/register?ref={user.referralCode}</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: colors.muted, fontSize: fontSize.sm },
  name: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  bell: { position: 'relative', padding: 6 },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  balanceLabel: { color: colors.muted, fontSize: fontSize.sm, marginTop: spacing.md },
  balance: { color: colors.cash, fontSize: 34, fontWeight: '800' },
  bonusLine: { color: colors.bonus, fontSize: fontSize.sm, marginTop: 2 },
  link: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingVertical: spacing.sm },
  actionText: { color: colors.text, fontSize: fontSize.xs, fontWeight: '600' },
  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#450A0A', borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, padding: spacing.md },
  livePill: { backgroundColor: colors.danger, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  livePillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  liveTitle: { flex: 1, color: colors.white, fontWeight: '700' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { width: '47%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  statValue: { fontSize: fontSize.lg, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1 },
  rowMain: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  rowAmount: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  status: { fontSize: 10, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: fontSize.sm },
  referral: { gap: spacing.xs },
  referralLink: { color: colors.primary, fontSize: fontSize.sm },
});
