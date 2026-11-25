import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api, type SubscriptionType } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const PLANS: {
  key: SubscriptionType; label: string; duration: string; suffix: string; detail: string;
  badge?: string; icon: string; perks: string[]; featured?: boolean;
}[] = [
  { key: 'daily', label: 'Daily', duration: '24 hours', suffix: 'day', detail: 'A single day of non-stop action', icon: 'flash', perks: ['Every live channel', 'Instant activation', 'Bonus balance accepted'] },
  { key: 'weekly', label: 'Weekly', duration: '7 days', suffix: 'week', detail: 'A full week of live sport', icon: 'calendar', perks: ['Every live channel', 'Instant activation', 'Save vs daily'] },
  { key: 'monthly', label: 'Monthly', duration: '30 days', suffix: 'month', detail: 'The fans’ favourite', badge: 'MOST POPULAR', icon: 'star', featured: true, perks: ['Every live channel', 'Best everyday value', 'Bonus balance accepted'] },
  { key: 'yearly', label: 'Yearly', duration: '365 days', suffix: 'year', detail: 'The ultimate fan pass', badge: 'BEST VALUE', icon: 'trophy', perks: ['Every live channel', 'Lowest price per day', 'Full year of sport'] },
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

  const spendable = (wallet?.availableBalance ?? 0) + (wallet?.bonusBalance ?? 0);

  const confirm = (key: SubscriptionType) => {
    const plan = PLANS.find((p) => p.key === key)!;
    const price = prices?.[key] ?? ({ daily: 1.7, weekly: 7, monthly: 20, yearly: 99 } as Record<SubscriptionType, number>)[key];
    if (spendable < price) {
      Alert.alert(
        'Not enough balance',
        `You need ${money(price)} but have ${money(spendable)}. Top up your wallet with Google Play, then come back to buy ${plan.label}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top up', onPress: () => router.push('/(tabs)/wallet') },
        ],
      );
      return;
    }
    Alert.alert(
      'Confirm subscription',
      `Purchase the ${plan.label} plan for ${money(price)}?\n\nBonus balance is used first. This purchase is non-refundable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => purchase.mutate(key) },
      ],
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Subscription" />
      <View style={styles.header}>
        <Text style={styles.kicker}>✦ PLATFORM ACCESS</Text>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>Unlock every live stream instantly</Text>
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

      <View style={styles.balanceRow}>
        <Ionicons name="wallet-outline" size={15} color={colors.primary} />
        <Text style={styles.spendable}>Spendable balance: {money(spendable)}</Text>
      </View>

      <SectionTitle>Plans</SectionTitle>
      {PLANS.map((p) => {
        const price = prices?.[p.key] ?? ({ daily: 1.7, weekly: 7, monthly: 20, yearly: 99 } as Record<SubscriptionType, number>)[p.key];
        const isCurrent = active?.hasSubscription && active.subscriptionType === p.key;
        const blocked = active?.hasSubscription && !isCurrent;
        return (
          <View key={p.key} style={[
            styles.plan,
            p.featured && styles.planFeatured,
            isCurrent && styles.planCurrent,
            blocked && styles.planBlocked,
          ]}>
            {p.featured && <View style={styles.glow} />}
            <View style={[styles.topAccent, p.featured && styles.topAccentFeatured]} />

            {!!p.badge && (
              <View style={[styles.badge, p.featured && styles.badgeFeatured]}>
                <Ionicons name="sparkles" size={11} color={p.featured ? colors.background : colors.onPrimary} />
                <Text style={[styles.badgeText, p.featured && styles.badgeTextFeatured]}>{p.badge}</Text>
              </View>
            )}

            <View style={styles.planHead}>
              <View style={[styles.planIcon, p.featured && styles.planIconFeatured]}>
                <Ionicons name={p.icon as never} size={20} color={p.featured ? colors.background : colors.primary} />
              </View>
              <View style={styles.planHeadText}>
                <Text style={styles.planName}>{p.label}</Text>
                <Text style={styles.planDetail}>{p.detail}</Text>
              </View>
              <View style={styles.durationPill}><Text style={styles.durationText}>{p.duration}</Text></View>
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.planPrice, p.featured && styles.planPriceFeatured]}>{money(price)}</Text>
              <Text style={styles.priceSuffix}>/ {p.suffix}</Text>
            </View>

            <View style={styles.perks}>
              {p.perks.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={14} color={p.featured ? colors.accent : colors.primary} />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => (isCurrent || blocked) ? undefined : confirm(p.key)}
              disabled={isCurrent || blocked || purchase.isPending}
              style={[
                styles.cta,
                p.featured ? styles.ctaFeatured : styles.ctaPlain,
                (isCurrent || blocked) && styles.ctaDisabled,
              ]}
            >
              <Text style={[styles.ctaText, p.featured ? styles.ctaTextFeatured : styles.ctaTextPlain]}>
                {isCurrent ? '✓ Currently active' : blocked ? 'Already subscribed' : `Get ${p.label}`}
              </Text>
              {!isCurrent && !blocked && <Ionicons name="arrow-forward" size={15} color={p.featured ? colors.background : colors.primary} />}
            </Pressable>
          </View>
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
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spendable: { color: colors.muted, fontSize: fontSize.sm },

  plan: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  planFeatured: {
    backgroundColor: '#14283A',
    borderColor: colors.accent,
    borderWidth: 1.5,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  planCurrent: { borderColor: colors.primary },
  planBlocked: { opacity: 0.55 },
  glow: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(245,158,11,0.13)' },
  topAccent: { position: 'absolute', top: 0, left: 24, right: 24, height: 2, backgroundColor: colors.primary, opacity: 0.5 },
  topAccentFeatured: { backgroundColor: colors.accent, opacity: 0.95, height: 3 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryDark, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeFeatured: { backgroundColor: colors.accent },
  badgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  badgeTextFeatured: { color: colors.background },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  planIconFeatured: { backgroundColor: colors.accent },
  planHeadText: { flex: 1, gap: 1 },
  planName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  planDetail: { color: colors.muted, fontSize: fontSize.xs },
  durationPill: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  durationText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  planPrice: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  planPriceFeatured: { color: colors.accent },
  priceSuffix: { color: colors.muted, fontSize: fontSize.xs },
  perks: { gap: 5, marginVertical: 2 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  perkText: { color: colors.muted, fontSize: fontSize.xs },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.md, paddingVertical: 12, marginTop: spacing.xs },
  ctaFeatured: { backgroundColor: colors.accent },
  ctaPlain: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primary },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: fontSize.sm, fontWeight: '800' },
  ctaTextFeatured: { color: colors.background },
  ctaTextPlain: { color: colors.primary },
  fine: { color: colors.muted, fontSize: fontSize.xs, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: '700' },
});
