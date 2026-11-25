import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, PrimaryButton, ScreenHeader, Screen, SectionTitle, TextField } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api, APP_ORIGIN } from '@/lib/api';
import { colors, fontSize, spacing } from '@/theme';

const money = (v?: number) => `$${(v ?? 0).toFixed(2)}`;
const err = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong';

export default function ReferralsScreen() {
  const { user, authedFetch, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const referralLink = user?.referralCode ? `${APP_ORIGIN}/register?ref=${user.referralCode}` : '';
  const isInfluencer = !!user?.isInfluencer;

  const referrals = useQuery({
    queryKey: ['my-referrals'],
    queryFn: () => authedFetch((t) => api.myReferrals(t)),
    enabled: isInfluencer,
  });
  const commission = useQuery({
    queryKey: ['commission-history'],
    queryFn: () => authedFetch((t) => api.commissionHistory(t)),
    enabled: isInfluencer,
  });

  const saveCode = async () => {
    setSaving(true);
    try {
      const res = await authedFetch((t) => api.updateReferralCode(t, code.trim()));
      refreshUser({ ...user!, referralCode: res.referralCode, referralCodeCustomized: true });
      setCode('');
      Alert.alert('Referral code saved', `${res.referralCode} is now your permanent code.`);
    } catch (e) {
      Alert.alert('Could not save', err(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Referrals" />
      <SectionTitle>{isInfluencer ? 'Influencer dashboard' : 'Refer & earn'}</SectionTitle>

      <Card>
        <Text style={styles.hint}>
          {isInfluencer
            ? 'Earn commission when people you refer subscribe or buy a stream.'
            : 'Earn a 5% bonus when a referred user buys their first stream.'}
        </Text>
        <View style={styles.row}><Text style={styles.label}>Your code</Text><Text style={styles.value} selectable>{user?.referralCode ?? '—'}</Text></View>
        {!!referralLink && <Text style={styles.link} selectable>{referralLink}</Text>}
      </Card>

      {isInfluencer && (
        <>
          {!user?.referralCodeCustomized && (
            <Card>
              <Text style={styles.title}>Customize your code</Text>
              <Text style={styles.hint}>Pick a memorable code. This can only be done once.</Text>
              <TextField
                label="Referral code"
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20))}
                placeholder="4-20 letters or numbers"
                autoCapitalize="characters"
              />
              <PrimaryButton title={saving ? 'Saving…' : 'Save code'} onPress={() => void saveCode()} disabled={saving || code.trim().length < 4} />
            </Card>
          )}

          <Card>
            <Text style={styles.title}>Referrals</Text>
            {referrals.isLoading && <ActivityIndicator color={colors.primary} />}
            {!!referrals.data && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Total referred</Text>
                  <Text style={styles.value}>{referrals.data.totalReferrals}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Commission earned</Text>
                  <Text style={[styles.value, styles.cash]}>{money(referrals.data.totalCommissionEarned)}</Text>
                </View>
                {(referrals.data.referrals ?? []).map((r) => (
                  <View key={r.id} style={styles.row}>
                    <Text style={styles.value}>{r.fullName}</Text>
                    <Text style={styles.date}>{new Date(r.joinedAt).toLocaleDateString()}</Text>
                  </View>
                ))}
              </>
            )}
            {referrals.isError && <Text style={styles.hint}>Could not load your referrals.</Text>}
          </Card>

          <Card>
            <Text style={styles.title}>Commission history</Text>
            {commission.isLoading && <ActivityIndicator color={colors.primary} />}
            {(commission.data ?? []).map((c) => (
              <View key={c.id} style={styles.row}>
                <View style={styles.text}>
                  <Text style={styles.value}>{c.description ?? 'Referral commission'}</Text>
                  <Text style={styles.date}>{new Date(c.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.value, styles.cash]}>+{money(c.amount)}</Text>
              </View>
            ))}
            {!commission.isLoading && (commission.data?.length ?? 0) === 0 && (
              <Text style={styles.hint}>No commissions earned yet.</Text>
            )}
            {commission.isError && <Text style={styles.hint}>Could not load commission history.</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '800', marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 19, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.muted, fontSize: fontSize.sm },
  value: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', flexShrink: 1 },
  cash: { color: colors.cash },
  link: { color: colors.primary, fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.sm },
  text: { flex: 1 },
  date: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
});
