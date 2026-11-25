import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, PrimaryButton, Screen, SectionTitle, TextField } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { CREDIT_PRODUCTS, getCreditProducts, isIapAvailable, purchaseCredit, syncIapUser, type CreditProduct } from '@/lib/iap';
import { colors, fontSize, radius, spacing } from '@/theme';

const money = (v?: number) => `$${(v ?? 0).toFixed(2)}`;
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong';

const PAYOUT_METHODS = [
  { value: 'mtn_momo', label: 'MTN MoMo', placeholder: '0771234567' },
  { value: 'airtel_money', label: 'Airtel Money', placeholder: '0751234567' },
  { value: 'btc_binance', label: 'Bitcoin (Binance)', placeholder: 'BTC wallet address' },
] as const;
const payoutLabel = (value?: string | null) => PAYOUT_METHODS.find((m) => m.value === value)?.label ?? value ?? '';

export default function WalletScreen() {
  const { authedFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const [voucher, setVoucher] = useState('');
  const [bonusCode, setBonusCode] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<string>('mtn_momo');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [confirmPayout, setConfirmPayout] = useState(false);
  const [creditProducts, setCreditProducts] = useState<CreditProduct[]>([...CREDIT_PRODUCTS]);
  const [selectedCredit, setSelectedCredit] = useState<string>(CREDIT_PRODUCTS[0].id);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void syncIapUser(user?.id); }, [user?.id]);
  useEffect(() => {
    if (!isIapAvailable()) return;
    void getCreditProducts().then(setCreditProducts);
  }, []);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'], queryFn: () => authedFetch((t) => api.wallet(t)),
  });
  const { data: tx } = useQuery({
    queryKey: ['wallet-transactions'], queryFn: () => authedFetch((t) => api.transactions(t, 8)),
  });
  const { data: bonuses } = useQuery({
    queryKey: ['my-bonuses'], queryFn: () => authedFetch((t) => api.myBonuses(t)),
  });
  const { data: payout, isLoading: loadingPayout } = useQuery({
    queryKey: ['payout-method'], queryFn: () => authedFetch((t) => api.payoutMethod(t)),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['my-bonuses'] });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); }
    catch (e) { Alert.alert('Error', message(e)); }
    finally { setBusy(false); }
  };

  const redeemVoucherCode = () => run(async () => {
    const res = await authedFetch((t) => api.redeemVoucher(t, voucher.replace(/-/g, '')));
    Alert.alert('Voucher redeemed', `${money(res.amount)} added to your wallet.`);
    setVoucher(''); refresh();
  });

  const buyCredits = () => run(async () => {
    if (!isIapAvailable()) {
      Alert.alert('Not available here', 'Install the Android app from Google Play to buy credits.');
      return;
    }
    await purchaseCredit(selectedCredit);
    Alert.alert('Payment complete', 'Your credits will appear in your wallet shortly. Tap OK to refresh.', [
      { text: 'OK', onPress: refresh },
    ]);
  });

  const applyBonus = () => run(async () => {
    const code = bonusCode.trim().toUpperCase();
    const check = await authedFetch((t) => api.validatePromo(t, code, 0));
    if (!check.valid) throw new Error(check.reason ?? 'This bonus code is not valid.');
    if (!check.isBonus) throw new Error('That code is not a bonus code.');
    Alert.alert(
      'Apply bonus',
      `${check.promotion?.name ?? 'Bonus'} — ${money(check.estimatedBonus)} will be added to your Bonus Wallet. Bonus funds are for livestreams only and cannot be withdrawn.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: () => {
          void run(async () => {
            await authedFetch((t) => api.applyPromo(t, code));
            Alert.alert('Bonus applied', `${money(check.estimatedBonus)} added to your Bonus Wallet.`);
            setBonusCode(''); refresh();
            void queryClient.invalidateQueries({ queryKey: ['my-bonuses'] });
          });
        } },
      ],
    );
  });

  const savePayout = () => run(async () => {
    await authedFetch((t) => api.savePayoutMethod(t, payoutMethod, payoutAccount.trim()));
    setConfirmPayout(false);
    setPayoutAccount('');
    void queryClient.invalidateQueries({ queryKey: ['payout-method'] });
    Alert.alert('Payout account saved', 'This account is locked. Contact support to change it.');
  });

  const withdraw = () => run(async () => {
    await authedFetch((t) => api.withdraw(t, Number(withdrawAmount)));
    Alert.alert('Withdrawal requested', 'Your request has been submitted and will be reviewed before payment.');
    setWithdrawAmount(''); refresh();
  });

  const formatVoucher = (raw: string) => {
    const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
    return clean.replace(/(.{4})(.{0,4})(.{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
  };

  return (
    <Screen>
      <SectionTitle>Wallet</SectionTitle>

      <View style={styles.moneyGrid}>
        <View style={styles.moneyRow}>
          <View style={styles.moneyCell}><Text style={[styles.moneyValue, styles.cash]}>{money(wallet?.availableBalance)}</Text><Text style={styles.moneyLabel}>Wallet (cash)</Text></View>
          <View style={styles.moneyCell}><Text style={[styles.moneyValue, styles.bonus]}>{money(wallet?.bonusBalance)}</Text><Text style={styles.moneyLabel}>Bonus wallet</Text></View>
        </View>
        <View style={styles.moneyRow}>
          <View style={styles.moneyCell}><Text style={styles.moneyValue}>{money((wallet?.availableBalance ?? 0) + (wallet?.bonusBalance ?? 0))}</Text><Text style={styles.moneyLabel}>Total balance</Text></View>
          <View style={styles.moneyCell}><Text style={styles.moneyValue}>{money(wallet?.withdrawableBalance)}</Text><Text style={styles.moneyLabel}>Withdrawable</Text></View>
        </View>
      </View>
      {isLoading && <ActivityIndicator color={colors.primary} />}

      {/* Deposit — mobile version: voucher only, in-app purchases coming next */}
      <Card>
        <Text style={styles.cardTitle}>Deposit</Text>
        <Text style={styles.hint}>Enter your 12-character ATA voucher code to credit your wallet instantly.</Text>
        <TextField label="Voucher code" value={voucher} onChangeText={(v) => setVoucher(formatVoucher(v))} placeholder="XXXX-XXXX-XXXX" maxLength={14} />
        <PrimaryButton title={busy ? 'Redeeming…' : 'Redeem Voucher'} onPress={redeemVoucherCode} disabled={voucher.replace(/-/g, '').length !== 12 || busy} />
        <Text style={styles.sectionLabel}>Or buy credits with Google Play</Text>
        <View style={styles.creditGrid}>
          {creditProducts.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => setSelectedCredit(p.id)}
              style={[styles.creditChip, selectedCredit === p.id && styles.creditChipActive]}
            >
              <Text style={[styles.creditChipText, selectedCredit === p.id && styles.creditChipTextActive]}>${p.amount}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton
          title={busy ? 'Processing…' : `Buy $${creditProducts.find((p) => p.id === selectedCredit)?.amount ?? 1} credits`}
          onPress={buyCredits}
          disabled={busy}
          tone="accent"
        />
        <Text style={styles.iapNote}>Credits are added by the server after Google Play confirms payment.</Text>
      </Card>

      {/* Bonus code directly below Deposit */}
      <Card style={styles.bonusCard}>
        <Text style={styles.cardTitle}>🎁 Redeem a Bonus Code</Text>
        <Text style={styles.hint}>Loads straight into your Bonus Wallet — no deposit needed. For livestreams only; not withdrawable.</Text>
        <TextField label="Bonus code" value={bonusCode} onChangeText={(v) => setBonusCode(v.toUpperCase())} placeholder="BONUS-A1B2C3" autoCapitalize="characters" />
        <PrimaryButton title={busy ? 'Working…' : 'Apply Bonus'} onPress={applyBonus} disabled={!bonusCode.trim() || busy} tone="accent" />
      </Card>

      {/* Payout account — required before any withdrawal */}
      <Card>
        <Text style={styles.cardTitle}>Withdrawal account</Text>
        {loadingPayout ? (
          <ActivityIndicator color={colors.primary} />
        ) : payout?.payoutMethod ? (
          <>
            <Text style={styles.hint}>Your payout account is locked. Contact support to change it.</Text>
            <View style={styles.row}>
              <Text style={styles.rowMain}>{payoutLabel(payout.payoutMethod)}</Text>
              <Text style={styles.rowSub}>{payout.payoutAccount}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Choose how you want to receive withdrawals. This can only be set once — check the details carefully.</Text>
            <Text style={styles.fieldLabel}>Payout method</Text>
            {PAYOUT_METHODS.map((m) => (
              <Pressable
                key={m.value}
                onPress={() => { setPayoutMethod(m.value); setPayoutAccount(''); setConfirmPayout(false); }}
                style={[styles.chip, payoutMethod === m.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, payoutMethod === m.value && styles.chipTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
            <TextField
              label={payoutMethod === 'btc_binance' ? 'Bitcoin address' : 'Mobile number'}
              value={payoutAccount}
              onChangeText={(v) => { setPayoutAccount(v); setConfirmPayout(false); }}
              placeholder={PAYOUT_METHODS.find((m) => m.value === payoutMethod)?.placeholder}
              keyboardType={payoutMethod === 'btc_binance' ? 'default' : 'phone-pad'}
            />
            {!!payoutAccount.trim() && !confirmPayout && (
              <Pressable onPress={() => setConfirmPayout(true)}>
                <Text style={styles.link}>Confirm {payoutLabel(payoutMethod)} — {payoutAccount.trim()}</Text>
              </Pressable>
            )}
            {confirmPayout && (
              <View style={styles.confirmBox}>
                <Text style={styles.hint}>Save {payoutLabel(payoutMethod)} as {payoutAccount.trim()}? This cannot be changed later.</Text>
                <PrimaryButton title={busy ? 'Saving…' : 'Save & lock'} onPress={savePayout} disabled={busy || !payoutAccount.trim()} />
                <Pressable onPress={() => setConfirmPayout(false)}><Text style={styles.link}>Go back</Text></Pressable>
              </View>
            )}
          </>
        )}
      </Card>

      {/* Withdrawal */}
      <Card>
        <Text style={styles.cardTitle}>Withdrawal</Text>
        <Text style={styles.hint}>
          {!user?.ficaCompleted
            ? 'Complete identity verification (FICA) in Profile before withdrawing.'
            : !payout?.payoutMethod
              ? 'Add a withdrawal account above before requesting a payout.'
              : 'Enter an amount to request a withdrawal. Requests are reviewed before payment.'}
        </Text>
        {!!user?.ficaCompleted && !!payout?.payoutMethod && (
          <>
            <TextField label="Amount (USD)" value={withdrawAmount} onChangeText={setWithdrawAmount} placeholder="0.00" keyboardType="decimal-pad" />
            <PrimaryButton title={busy ? 'Submitting…' : 'Request Withdrawal'} onPress={withdraw} disabled={Number(withdrawAmount) < 1 || busy} tone="accent" />
          </>
        )}
      </Card>

      {/* Histories */}
      <Card>
        <Text style={styles.cardTitle}>Bonus history</Text>
        {(bonuses?.transactions?.length ?? 0) === 0
          ? <Text style={styles.hint}>No bonus transactions yet.</Text>
          : bonuses!.transactions.slice(0, 6).map((b) => (
            <View key={b.id} style={styles.row}>
              <Text style={styles.rowMain}>{b.description ?? b.promotionName ?? b.type}</Text>
              <Text style={[styles.rowAmount, b.amount >= 0 ? styles.cash : styles.muted]}>{b.amount >= 0 ? '+' : '−'}{money(Math.abs(b.amount))}</Text>
            </View>
          ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Recent transactions</Text>
        {(tx?.transactions?.length ?? 0) === 0
          ? <Text style={styles.hint}>No transactions yet.</Text>
          : tx!.transactions.map((t) => (
            <View key={t.id} style={styles.row}>
              <View style={styles.rowMainWrap}>
                <Text style={styles.rowMain}>{t.type.replace(/_/g, ' ')}</Text>
                <Text style={styles.rowSub}>{new Date(t.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.rowAmount, ['deposit', 'bet_win', 'bet_refund', 'admin_credit'].includes(t.type) ? styles.cash : styles.muted]}>
                {['deposit', 'bet_win', 'bet_refund', 'admin_credit'].includes(t.type) ? '+' : '−'}{money(Math.abs(t.amount))}
              </Text>
            </View>
          ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  moneyGrid: { gap: spacing.sm },
  moneyRow: { flexDirection: 'row', gap: spacing.sm },
  moneyCell: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  moneyValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  moneyLabel: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  cash: { color: colors.cash }, bonus: { color: colors.bonus }, muted: { color: colors.muted },
  cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', marginBottom: spacing.sm },
  hint: { color: colors.muted, fontSize: fontSize.sm, lineHeight: 19 },
  iapNote: { color: colors.muted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.sm },
  sectionLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  creditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  creditChip: { minWidth: 58, alignItems: 'center', paddingVertical: 9, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  creditChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  creditChipText: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm },
  creditChipTextActive: { color: colors.onPrimary },
  bonusCard: { borderColor: '#FACC1555', gap: spacing.sm },
  fieldLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  chip: { paddingVertical: 7, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, marginBottom: 6 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontSize: fontSize.sm },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  link: { color: colors.primary, textDecorationLine: 'underline', paddingVertical: spacing.sm },
  confirmBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMainWrap: { flex: 1 },
  rowMain: { color: colors.text, fontSize: fontSize.sm, flex: 1, textTransform: 'capitalize' },
  rowSub: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  rowAmount: { fontWeight: '800', fontSize: fontSize.sm },
});
