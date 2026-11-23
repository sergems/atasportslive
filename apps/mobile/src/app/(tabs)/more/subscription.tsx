import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api, type SubscriptionType } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const PLANS: { key: SubscriptionType; label: string; duration: string; detail: string; badge?: string }[] = [
  { key: 'daily', label: 'Daily', duration: '24 hours', detail: 'Perfect for catching a single event' },
  { key: 'weekly', label: 'Weekly', duration: '7 days', detail: 'A week of non-stop action' },
  { key: 'monthly', label: 'Monthly', duration: '30 days', detail: 'The fan favourite', badge: 'POPULAR' },
  { key: 'yearly', label: 'Yearly', duration: '365 days', detail: 'Best value for true fans', badge: 'BEST VALUE' },
];

const money = (v?: number) => `$${(v ?? 0).toFixed(2)}`;

export default function SubscriptionScreen() {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const { data: prices } = useQuery({ queryKey: ['subscription-prices'], queryFn: api.subscriptionPrices });
  const { data: active } = useQuery({
    queryKey: ['subscription-active'], queryFn: () => authedFetch((t) => api.activeSubscription(t)),
  });
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => authedFetch((t) => api.wallet(t)) });

  const purchase = useMutation({
    mutationFn: (type: SubscriptionType) => authedFetch((t) => api.purchaseSubscription(t, type)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-active'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      Alert.alert('Access unlocked', 'Your subscription is active. Enjoy the streams!', [
        { text: 'OK', onPress: () => router.push('/(tabs)/live') },
      ]);
    },
    onError: (e) => Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Could not purchase the plan'),
  });

  const confirm = (key: SubscriptionType) => {
    const plan = PLANS.find((p) => p.key === key)!;
    Alert.alert(
      'Confirm subscription',
      `Purchase the ${plan.label} plan for ${money(prices?.[key] ?? 1.7)}?\n\nBonus balance is used first. This purchase is non-refundable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => purchase.mutate(key) },
      ],
    );
  };

  const spendable = (wallet?.availableBalance ?? 0) + (wallet?.bonusBalance ?? 0);

  return (
    <Screen>
      <ScreenHeader title="Subscription" />
      <View style={styles.header}>
        <Text style={styles.kicker}>✦ PLATFORM ACCESS</Text>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>Deducted from your wallet instantly</Text>
      </View>

      <Card style={[styles.statusCard, active?.hasSubscription && styles.statusActive]}>
        {active?.hasSubscription ? (
          <>
            <View style={styles.statusTop}>
              <Text style={styles.statusTitle}>{active.subscriptionType ?? 'Active'} plan</Text>
              <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View>
            </View>
            <Text style={styles.statusText}>
              Expires {active.expiresAt ? new Date(active.expiresAt).toLocaleString() : 'soon'}
            </Text>
            <Pressable style={styles.watchButton} onPress={() => router.push('/(tabs)/live')}>
              <Text style={styles.watchButtonText}>Watch live →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Ionicons name="lock-closed-outline" size={22} color={colors.muted} />
            <Text style={styles.statusText}>No active subscription — pick a plan below to unlock all live streams.</Text>
          </>
        )}
      </Card>

      <Text style={styles.spendable}>Spendable balance: {money(spendable)}</Text>

      <SectionTitle>Plans</SectionTitle>
      {PLANS.map((p) => {
        const price = prices?.[p.key] ?? ({ daily: 1.7, weekly: 7, monthly: 20, yearly: 99 } as Record<SubscriptionType, number>)[p.key];
        const isCurrent = active?.hasSubscription && active.subscriptionType === p.key;
        const blocked = active?.hasSubscription && !isCurrent;
        return (
          <Pressable
            key={p.key}
            onPress={() => (isCurrent || blocked) ? undefined : confirm(p.key)}
            style={[styles.plan, isCurrent && styles.planCurrent, blocked && styles.planBlocked]}
          >
            {!!p.badge && <View style={styles.badge}><Text style={styles.badgeText}>{p.badge}</Text></View>}
            <Text style={styles.planName}>{p.label}</Text>
            <Text style={styles.planDetail}>{p.detail}</Text>
            <View style={styles.planBottom}>
              <Text style={styles.planPrice}>{money(price)}</Text>
              <Text style={styles.planDuration}>{p.duration}</Text>
            </View>
            <Text style={styles.planCta}>
              {isCurrent ? '✓ Currently active' : blocked ? 'Already subscribed' : `Get ${p.label}`}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.fine}>Bonus balance is used first. All plans unlock every live stream. Non-refundable.</Text>
      {purchase.isPending && <ActivityIndicator color={colors.primary} />}
      <Pressable onPress={() => router.push('/(tabs)/wallet')}><Text style={styles.link}>Top up wallet →</Text></Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2 },
  kicker: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: fontSize.sm },
  statusCard: { gap: spacing.sm },
  statusActive: { borderColor: colors.primary },
  statusTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textTransform: 'capitalize' },
  activePill: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  activePillText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
  statusText: { color: colors.muted, fontSize: fontSize.sm },
  watchButton: { backgroundColor: colors.primary, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
  watchButtonText: { color: colors.onPrimary, fontWeight: '800' },
  spendable: { color: colors.muted, fontSize: fontSize.sm },
  plan: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  planCurrent: { borderColor: colors.primary },
  planBlocked: { opacity: 0.6 },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: colors.background, fontSize: 9, fontWeight: '800' },
  planName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  planDetail: { color: colors.muted, fontSize: fontSize.sm },
  planBottom: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 4 },
  planPrice: { color: colors.primary, fontSize: fontSize.xl, fontWeight: '800' },
  planDuration: { color: colors.muted, fontSize: fontSize.sm },
  planCta: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm, marginTop: spacing.sm },
  fine: { color: colors.muted, fontSize: fontSize.xs, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: '700' },
});
