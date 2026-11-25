import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, PrimaryButton, Screen, SectionTitle, SegmentedTabs, TextField } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { colors, fontSize, radius, spacing } from '@/theme';

const PROVIDERS = [
  ['MTN_MOMO_UGA', '🇺🇬 MTN MoMo — Uganda'], ['AIRTEL_UGA', '🇺🇬 Airtel Money — Uganda'],
  ['MPESA_KEN', '🇰🇪 M-Pesa — Kenya'], ['AIRTEL_KEN', '🇰🇪 Airtel Money — Kenya'],
  ['VODACOM_TZA', '🇹🇿 M-Pesa — Tanzania'], ['AIRTEL_TZA', '🇹🇿 Airtel Money — Tanzania'],
  ['TIGO_TZA', '🇹🇿 Tigo Pesa — Tanzania'], ['MTN_MOMO_RWA', '🇷🇼 MTN MoMo — Rwanda'],
  ['AIRTEL_RWA', '🇷🇼 Airtel Money — Rwanda'], ['MTN_MOMO_ZMB', '🇿🇲 MTN MoMo — Zambia'],
  ['AIRTEL_ZMB', '🇿🇲 Airtel Money — Zambia'], ['MTN_MOMO_GHA', '🇬🇭 MTN MoMo — Ghana'],
  ['MPESA_MOZ', '🇲🇿 M-Pesa — Mozambique'], ['VODACOM_COD', '🇨🇩 M-Pesa — DR Congo'],
  ['AIRTEL_COD', '🇨🇩 Airtel Money — DR Congo'], ['AIRTEL_MWI', '🇲🇼 Airtel Money — Malawi'],
  ['MTN_MOMO_CMR', '🇨🇲 MTN MoMo — Cameroon'], ['ORANGE_CIV', '🇨🇮 Orange Money — Côte d’Ivoire'],
] as const;

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
  const [depositTab, setDepositTab] = useState('pawapay');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState<string>('MTN_MOMO_UGA');
  const [voucher, setVoucher] = useState('');
  const [bonusCode, setBonusCode] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<string>('mtn_momo');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [confirmPayout, setConfirmPayout] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState<string | null>(null);
  const [pesapalRef, setPesapalRef] = useState<string | null>(null);
  const pawapayAttempts = useRef(0);
  const pesapalAttempts = useRef(0);
  const [busy, setBusy] = useState(false);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['wallet'], queryFn: () => authedFetch((t) => api.wallet(t)),
  });
  const { data: gateway } = useQuery({ queryKey: ['gateway-status'], queryFn: api.gatewayStatus, staleTime: 60_000 });
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

  // Confirm payment / poll PawaPay while the deposit is pending.
  const poll = useQuery({
    queryKey: ['pawapay-status', pendingDeposit],
    queryFn: () => authedFetch((t) => api.pawapayDepositStatus(t, pendingDeposit!)),
    enabled: !!pendingDeposit,
    refetchInterval: () => {
      pawapayAttempts.current += 1;
      return pawapayAttempts.current > 40 ? false : 3000;
    },
  });
  const pesapalPoll = useQuery({
    queryKey: ['pesapal-status', pesapalRef],
    queryFn: () => authedFetch((t) => api.pesapalStatus(t, pesapalRef!)),
    enabled: !!pesapalRef,
    refetchInterval: () => {
      pesapalAttempts.current += 1;
      return pesapalAttempts.current > 40 ? false : 3000;
    },
  });
  React.useEffect(() => {
    if (poll.data?.status === 'completed') {
      // Poll results come from the network; the UI must react to the status change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingDeposit(null); setAmount(''); setPhone(''); refresh();
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      Alert.alert('Deposit confirmed', `${money(poll.data.amount)} added to your wallet.`);
    } else if (poll.data?.status === 'failed') {
      setPendingDeposit(null);
      Alert.alert('Deposit failed', 'The payment was declined or cancelled.');
    }
  }, [poll.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const status = pesapalPoll.data?.status;
    if (status === 'completed' || status === 'failed') {
      // Poll results come from the network; the UI must react to the status change.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPesapalRef(null);
      setWithdrawAmount('');
      refresh();
      Alert.alert(
        status === 'completed' ? 'Deposit confirmed' : 'Deposit not completed',
        status === 'completed'
          ? `${money(pesapalPoll.data?.amount)} added to your wallet.`
          : 'The payment was not completed. Please try again.',
      );
    }
  }, [pesapalPoll.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); }
    catch (e) { Alert.alert('Error', message(e)); }
    finally { setBusy(false); }
  };

  const payPawapay = () => run(async () => {
    const res = await authedFetch((t) => api.pawapayDeposit(t, Number(amount), phone.trim(), provider));
    pawapayAttempts.current = 0;
    setPendingDeposit(res.depositId);
  });

  const payPesapal = () => run(async () => {
    const res = await authedFetch((t) => api.pesapalInitiate(t, Number(amount)));
    pesapalAttempts.current = 0;
    setPesapalRef(res.transactionId);
    Alert.alert('Complete payment', 'Finish the payment in your browser. This screen updates once it is confirmed.', [
      { text: 'Continue', onPress: () => {
        void (async () => {
          const supported = await Linking.canOpenURL(res.redirectUrl);
          if (supported) await Linking.openURL(res.redirectUrl);
          else Alert.alert('Open in browser', res.redirectUrl);
        })();
      } },
    ]);
  });

  const redeemVoucherCode = () => run(async () => {
    const res = await authedFetch((t) => api.redeemVoucher(t, voucher.replace(/-/g, '')));
    Alert.alert('Voucher redeemed', `${money(res.amount)} added to your wallet.`);
    setVoucher(''); refresh();
  });

  const applyBonus = () => run(async () => {
    const code = bonusCode.trim().toUpperCase();
    const check = await authedFetch((t) => api.validatePromo(t, code, 0));
    if (!check.valid) throw new Error(check.reason ?? 'This bonus code is not valid.');
    if (!check.isBonus) throw new Error('That is a deposit promo. Use it in the Deposit tab.');
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
            queryClient.invalidateQueries({ queryKey: ['my-bonuses'] });
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

      {/* Bonus code */}
      <Card style={styles.bonusCard}>
        <Text style={styles.cardTitle}>🎁 Redeem a Bonus Code</Text>
        <Text style={styles.hint}>Loads straight into your Bonus Wallet — no deposit needed. For livestreams only; not withdrawable.</Text>
        <TextField label="Bonus code" value={bonusCode} onChangeText={(v) => setBonusCode(v.toUpperCase())} placeholder="BONUS-A1B2C3" autoCapitalize="characters" />
        <PrimaryButton title={busy ? 'Working…' : 'Apply Bonus'} onPress={applyBonus} disabled={!bonusCode.trim() || busy} tone="accent" />
      </Card>

      {/* Deposit */}
      <Card>
        <Text style={styles.cardTitle}>Deposit</Text>
        <SegmentedTabs
          value={depositTab}
          onChange={setDepositTab}
          options={[
            { value: 'pawapay', label: 'PawaPay' },
            { value: 'pesapal', label: 'Pesapal' },
            { value: 'voucher', label: 'Voucher' },
          ]}
        />
        {!!gateway && !gateway.pawapayEnabled && <Text style={styles.hint}>PawaPay is temporarily unavailable — use Pesapal or a voucher.</Text>}
        {!!gateway && !gateway.pesapalEnabled && <Text style={styles.hint}>Pesapal is temporarily unavailable — use PawaPay or a voucher.</Text>}

        {depositTab !== 'voucher' && (
          <>
            <TextField label="Amount (USD)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
            <Text style={styles.hint}>Have a bonus code? Use the Bonus Code field above.</Text>
          </>
        )}

        {depositTab === 'pawapay' && (
          <>
            {pendingDeposit ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={colors.cash} size="large" />
                <Text style={styles.waitingTitle}>Check your phone!</Text>
                <Text style={styles.hint}>Approve the mobile money prompt sent to {phone}. This screen updates automatically.</Text>
                <Pressable onPress={() => setPendingDeposit(null)}><Text style={styles.link}>Cancel / Try again</Text></Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Mobile network</Text>
                <ScrollView style={styles.providerList} nestedScrollEnabled>
                  {PROVIDERS.map(([value, label]) => (
                    <Pressable key={value} onPress={() => setProvider(value)} style={[styles.chip, provider === value && styles.chipActive]}>
                      <Text style={[styles.chipText, provider === value && styles.chipTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextField label="Mobile number" value={phone} onChangeText={setPhone} placeholder="e.g. 0771234567" keyboardType="phone-pad" />
                <PrimaryButton title={busy ? 'Sending prompt…' : 'Pay with PawaPay'} onPress={payPawapay} disabled={Number(amount) < 1 || !phone.trim() || busy} />
              </>
            )}
          </>
        )}

        {depositTab === 'pesapal' && (
          <>
            <Text style={styles.hint}>Pay securely with MTN MoMo, Airtel Money or Visa/Mastercard via Pesapal. Minimum $1.00.</Text>
            <PrimaryButton title={busy ? 'Opening Pesapal…' : 'Pay with Pesapal'} onPress={payPesapal} disabled={Number(amount) < 1 || busy} tone="accent" />
          </>
        )}

        {depositTab === 'voucher' && (
          <>
            <Text style={styles.hint}>Enter your 12-character ATA voucher code to credit your wallet instantly.</Text>
            <TextField label="Voucher code" value={voucher} onChangeText={(v) => setVoucher(formatVoucher(v))} placeholder="XXXX-XXXX-XXXX" maxLength={14} />
            <PrimaryButton title={busy ? 'Redeeming…' : 'Redeem Voucher'} onPress={redeemVoucherCode} disabled={voucher.replace(/-/g, '').length !== 12 || busy} />
          </>
        )}
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
  bonusCard: { borderColor: '#FACC1555', gap: spacing.sm },
  promoRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  promoInput: { flex: 1 },
  smallButton: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 13 },
  smallButtonText: { color: colors.primary, fontWeight: '700' },
  fieldLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  providerList: { maxHeight: 130 },
  chip: { paddingVertical: 7, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, marginBottom: 6 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.muted, fontSize: fontSize.sm },
  chipTextActive: { color: colors.onPrimary, fontWeight: '700' },
  waiting: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  waitingTitle: { color: colors.text, fontWeight: '800', fontSize: fontSize.lg },
  link: { color: colors.primary, textDecorationLine: 'underline', paddingVertical: spacing.sm },
  confirmBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMainWrap: { flex: 1 },
  rowMain: { color: colors.text, fontSize: fontSize.sm, flex: 1, textTransform: 'capitalize' },
  rowSub: { color: colors.muted, fontSize: fontSize.xs, marginTop: 2 },
  rowAmount: { fontWeight: '800', fontSize: fontSize.sm },
});
