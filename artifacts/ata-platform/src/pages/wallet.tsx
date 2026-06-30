import React, { useEffect, useState } from 'react';
import { useGetWallet, useListMyBets } from '@workspace/api-client-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ArrowDownLeft, ArrowUpRight, Ticket, Wallet as WalletIcon,
  CreditCard, Clock, ExternalLink, Lock, Smartphone, Bitcoin,
  CheckCircle2, AlertTriangle, ShieldCheck, Gift, Sparkles, Tag,
  Zap, Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { getGetWalletQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';
import { Link, useSearch } from 'wouter';

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchPayoutMethod() {
  const res = await fetch('/api/wallet/payout-method', { headers: authHeaders() });
  return res.json() as Promise<{ payoutMethod: string | null; payoutAccount: string | null; payoutMethodSetAt: string | null }>;
}

async function savePayoutMethod(payoutMethod: string, payoutAccount: string) {
  const res = await fetch('/api/wallet/payout-method', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ payoutMethod, payoutAccount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save payout method');
  return data;
}

async function initiateWithdrawal(amount: number) {
  const res = await fetch('/api/wallet/withdraw', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
  return data;
}

async function initiatePesapal(amount: number) {
  const res = await fetch('/api/wallet/pesapal/initiate', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment initiation failed');
  return data as { redirectUrl: string; transactionId: string };
}

async function redeemVoucher(code: string) {
  const res = await fetch('/api/wallet/redeem-voucher', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redemption failed');
  return data;
}

async function checkPesapalStatus(ref: string) {
  const res = await fetch(`/api/wallet/pesapal/status?ref=${ref}`, { headers: authHeaders() });
  return res.json() as Promise<{ status: string; amount: number }>;
}

async function initiatePawapayDeposit(amount: number, phoneNumber: string, provider: string) {
  const res = await fetch('/api/wallet/pawapay/deposit', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, phoneNumber, provider }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'PawaPay deposit failed');
  return data as { depositId: string; status: string };
}

async function checkPawapayDepositStatus(depositId: string) {
  const res = await fetch(`/api/wallet/pawapay/deposit/status?depositId=${depositId}`, { headers: authHeaders() });
  return res.json() as Promise<{ status: string; amount: number }>;
}

async function getGatewayStatus() {
  const res = await fetch('/api/wallet/gateway-status');
  return res.json() as Promise<{ pesapalEnabled: boolean; pawapayEnabled: boolean; pawapayConfigured: boolean }>;
}

const PAWAPAY_PROVIDERS = [
  // Uganda
  { value: 'MTN_MOMO_UGA',    label: '🇺🇬 MTN MoMo — Uganda',               hint: 'e.g. 0771234567' },
  { value: 'AIRTEL_UGA',      label: '🇺🇬 Airtel Money — Uganda',            hint: 'e.g. 0751234567' },
  // Kenya
  { value: 'MPESA_KEN',       label: '🇰🇪 M-Pesa — Kenya',                   hint: 'e.g. 0712345678' },
  { value: 'AIRTEL_KEN',      label: '🇰🇪 Airtel Money — Kenya',             hint: 'e.g. 0733000000' },
  // Tanzania
  { value: 'VODACOM_TZA',     label: '🇹🇿 M-Pesa (Vodacom) — Tanzania',      hint: 'e.g. 0754000000' },
  { value: 'AIRTEL_TZA',      label: '🇹🇿 Airtel Money — Tanzania',          hint: 'e.g. 0780000000' },
  { value: 'TIGO_TZA',        label: '🇹🇿 Tigo Pesa — Tanzania',             hint: 'e.g. 0716000000' },
  { value: 'HALOTEL_TZA',     label: '🇹🇿 HaloPesa — Tanzania',              hint: 'e.g. 0621000000' },
  { value: 'ZANTEL_TZA',      label: '🇹🇿 Zantel — Tanzania',                hint: 'e.g. 0777000000' },
  // Rwanda
  { value: 'MTN_MOMO_RWA',    label: '🇷🇼 MTN MoMo — Rwanda',               hint: 'e.g. 0781234567' },
  { value: 'AIRTEL_RWA',      label: '🇷🇼 Airtel Money — Rwanda',            hint: 'e.g. 0731234567' },
  // Zambia
  { value: 'MTN_MOMO_ZMB',    label: '🇿🇲 MTN MoMo — Zambia',               hint: 'e.g. 0961234567' },
  { value: 'AIRTEL_ZMB',      label: '🇿🇲 Airtel Money — Zambia',            hint: 'e.g. 0971234567' },
  { value: 'ZAMTEL_ZMB',      label: '🇿🇲 Zamtel Kwacha — Zambia',           hint: 'e.g. 0951234567' },
  // Ghana
  { value: 'MTN_MOMO_GHA',    label: '🇬🇭 MTN MoMo — Ghana',                hint: 'e.g. 0241234567' },
  { value: 'VODAFONE_GHA',    label: '🇬🇭 Telecel Cash (Vodafone) — Ghana',  hint: 'e.g. 0201234567' },
  { value: 'AIRTELTIGO_GHA',  label: '🇬🇭 AirtelTigo Money — Ghana',         hint: 'e.g. 0261234567' },
  // Mozambique
  { value: 'MPESA_MOZ',       label: '🇲🇿 M-Pesa (Vodacom) — Mozambique',   hint: 'e.g. 0841234567' },
  { value: 'TMCEL_MOZ',       label: '🇲🇿 mKesh (Tmcel) — Mozambique',       hint: 'e.g. 0821234567' },
  { value: 'MOVITEL_MOZ',     label: '🇲🇿 e-Mola (Movitel) — Mozambique',   hint: 'e.g. 0861234567' },
  // DR Congo
  { value: 'VODACOM_COD',     label: '🇨🇩 M-Pesa (Vodacom) — DR Congo',     hint: 'e.g. 0811234567' },
  { value: 'AIRTEL_COD',      label: '🇨🇩 Airtel Money — DR Congo',          hint: 'e.g. 0991234567' },
  { value: 'ORANGE_COD',      label: '🇨🇩 Orange Money — DR Congo',          hint: 'e.g. 0851234567' },
  // Malawi
  { value: 'AIRTEL_MWI',      label: '🇲🇼 Airtel Money — Malawi',            hint: 'e.g. 0991234567' },
  { value: 'TNM_MWI',         label: '🇲🇼 TNM Mpamba — Malawi',              hint: 'e.g. 0881234567' },
  // Cameroon
  { value: 'MTN_MOMO_CMR',    label: '🇨🇲 MTN MoMo — Cameroon',             hint: 'e.g. 0671234567' },
  { value: 'ORANGE_CMR',      label: '🇨🇲 Orange Money — Cameroon',          hint: 'e.g. 0691234567' },
  // Senegal
  { value: 'ORANGE_SEN',      label: '🇸🇳 Orange Money — Senegal',           hint: 'e.g. 771234567' },
  { value: 'FREE_SEN',        label: '🇸🇳 Free Money — Senegal',             hint: 'e.g. 761234567' },
  { value: 'EXPRESSO_SEN',    label: '🇸🇳 Expresso Money — Senegal',         hint: 'e.g. 701234567' },
  // Côte d'Ivoire
  { value: 'MTN_MOMO_CIV',    label: "🇨🇮 MTN MoMo — Côte d'Ivoire",        hint: 'e.g. 0701234567' },
  { value: 'ORANGE_CIV',      label: "🇨🇮 Orange Money — Côte d'Ivoire",     hint: 'e.g. 0711234567' },
  { value: 'MOOV_CIV',        label: "🇨🇮 Moov Money — Côte d'Ivoire",       hint: 'e.g. 0811234567' },
  // Burkina Faso
  { value: 'ORANGE_BFA',      label: '🇧🇫 Orange Money — Burkina Faso',      hint: 'e.g. 71234567' },
  // Togo
  { value: 'TOGOCOM_TGO',     label: '🇹🇬 T-Money (Togocom) — Togo',        hint: 'e.g. 90123456' },
  { value: 'MOOV_TGO',        label: '🇹🇬 Moov Money — Togo',               hint: 'e.g. 91123456' },
  // Benin
  { value: 'MTN_MOMO_BEN',    label: '🇧🇯 MTN MoMo — Benin',                hint: 'e.g. 97123456' },
  { value: 'MOOV_BEN',        label: '🇧🇯 Moov Money — Benin',               hint: 'e.g. 95123456' },
  // Mali
  { value: 'ORANGE_MLI',      label: '🇲🇱 Orange Money — Mali',              hint: 'e.g. 70123456' },
];

const PAYOUT_METHODS = [
  { value: 'mtn_momo',     label: 'MTN MoMo',           icon: Smartphone, placeholder: 'e.g. 0771234567',        hint: 'Enter your MTN mobile number' },
  { value: 'airtel_money', label: 'Airtel Money',        icon: Smartphone, placeholder: 'e.g. 0751234567',        hint: 'Enter your Airtel mobile number' },
  { value: 'btc_binance',  label: 'Bitcoin (Binance)',   icon: Bitcoin,    placeholder: 'e.g. 1A1zP1eP5QGef2nm…', hint: 'Enter your Bitcoin wallet address' },
];

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  btc_binance: 'Bitcoin (Binance)',
};

export default function Wallet() {
  useEffect(() => { document.title = 'Wallet - ATA Platform'; }, []);

  const search = useSearch();
  const params = new URLSearchParams(search);
  const paymentStatus = params.get('payment');
  const paymentRef = params.get('ref');

  const queryClient = useQueryClient();
  const { data: wallet, isLoading: loadingWallet } = useGetWallet();
  const { data: payoutData, isLoading: loadingPayout } = useQuery({
    queryKey: ['payout-method'],
    queryFn: fetchPayoutMethod,
  });

  const [depositAmount, setDepositAmount] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [depositTab, setDepositTab] = useState<'pawapay' | 'pesapal' | 'voucher'>('pawapay');
  const [pawapayPhone, setPawapayPhone] = useState('');
  const [pawapayProvider, setPawapayProvider] = useState('MTN_MOMO_UGA');
  const [pawapayDepositId, setPawapayDepositId] = useState<string | null>(null);
  const [withdrawTab, setWithdrawTab] = useState<'pawapay' | 'standard'>('pawapay');
  const [pawapayWithdrawPhone, setPawapayWithdrawPhone] = useState('');
  const [pawapayWithdrawProvider, setPawapayWithdrawProvider] = useState('MTN_MOMO_UGA');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoValidation, setPromoValidation] = useState<{ valid: boolean; estimatedBonus?: number; promotionId?: number; termsConditions?: string; name?: string; reason?: string } | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingBonus, setPendingBonus] = useState<{ promotionId: number; name: string; estimatedBonus: number; termsConditions: string | null; depositTransactionId: string } | null>(null);

  // Payout method setup state
  const [newPayoutMethod, setNewPayoutMethod] = useState('mtn_momo');
  const [newPayoutAccount, setNewPayoutAccount] = useState('');
  const [confirmSetup, setConfirmSetup] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
  const invalidatePayout = () => queryClient.invalidateQueries({ queryKey: ['payout-method'] });

  const { data: gatewayStatus } = useQuery({
    queryKey: ['gateway-status'],
    queryFn: getGatewayStatus,
    staleTime: 60_000,
  });
  const pawapayConfigured = gatewayStatus?.pawapayConfigured ?? false;
  const pawapayEnabled   = gatewayStatus?.pawapayEnabled   ?? true;
  const pesapalEnabled   = gatewayStatus?.pesapalEnabled   ?? true;

  // If the currently-selected deposit tab becomes disabled, fall back to voucher
  useEffect(() => {
    if (depositTab === 'pawapay' && !pawapayEnabled) setDepositTab('pesapal');
    if (depositTab === 'pesapal' && !pesapalEnabled) setDepositTab('voucher');
  }, [pawapayEnabled, pesapalEnabled]);

  // Pending/matched bets locking funds
  const { data: pendingBetsData } = useListMyBets({ status: 'pending', limit: 100 });
  const { data: matchedBetsData } = useListMyBets({ status: 'matched', limit: 100 });
  const activeBetsCount = (pendingBetsData?.total ?? 0) + (matchedBetsData?.total ?? 0);
  const lockedAmount = wallet?.pendingBalance ?? 0;

  const { data: statusData } = useQuery({
    queryKey: ['pesapal-status', paymentRef],
    queryFn: () => checkPesapalStatus(paymentRef!),
    enabled: !!paymentRef && paymentStatus === 'pending',
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 3000 : false),
  });

  useEffect(() => {
    if (paymentStatus === 'success') {
      toast.success('Payment Successful!', { description: 'Your wallet has been credited.' });
      invalidate();
    } else if (paymentStatus === 'error') {
      toast.error('Payment failed or was cancelled.');
    }
  }, [paymentStatus]);

  useEffect(() => {
    if (statusData?.status === 'completed') {
      toast.success('Payment Confirmed!', { description: `$${statusData.amount} credited to your wallet.` });
      invalidate();
    }
  }, [statusData?.status]);

  const pawapayMutation = useMutation({
    mutationFn: () => initiatePawapayDeposit(parseFloat(depositAmount), pawapayPhone.trim(), pawapayProvider),
    onSuccess: (data) => {
      setPawapayDepositId(data.depositId);
      toast.info('Check your phone!', { description: 'A payment prompt has been sent to your mobile number.' });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: pawapayPollData } = useQuery({
    queryKey: ['pawapay-deposit-status', pawapayDepositId],
    queryFn: () => checkPawapayDepositStatus(pawapayDepositId!),
    enabled: !!pawapayDepositId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return (!s || s === 'pending') ? 3000 : false;
    },
  });

  useEffect(() => {
    if (pawapayPollData?.status === 'completed') {
      toast.success('Payment Confirmed!', { description: `$${pawapayPollData.amount} credited to your wallet.` });
      invalidate();
      setPawapayDepositId(null);
      setDepositAmount('');
      setPawapayPhone('');
    } else if (pawapayPollData?.status === 'failed') {
      toast.error('Payment failed or was declined.');
      setPawapayDepositId(null);
    }
  }, [pawapayPollData?.status]);

  const pawapayWithdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/wallet/pawapay/withdraw', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: parseFloat(withdrawAmount), phoneNumber: pawapayWithdrawPhone.trim(), provider: pawapayWithdrawProvider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      return data;
    },
    onSuccess: () => {
      toast.success('Withdrawal sent!', { description: 'Your funds are on the way to your mobile money account.' });
      invalidate();
      setWithdrawAmount('');
      setPawapayWithdrawPhone('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pesapalMutation = useMutation({
    mutationFn: () => initiatePesapal(parseFloat(depositAmount)),
    onSuccess: (data) => { window.location.href = data.redirectUrl; },
    onError: (err: any) => toast.error(err.message),
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: parseFloat(depositAmount), paymentMethod: 'mtn_momo' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: (data) => {
      invalidate();
      toast.success('Deposit successful!');
      setDepositAmount('');
      if (data.pendingBonus) {
        setPendingBonus(data.pendingBonus);
        setShowTermsModal(true);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const redeemMutation = useMutation({
    mutationFn: () => redeemVoucher(voucherCode.trim()),
    onSuccess: (data) => {
      invalidate();
      toast.success('Voucher Redeemed!', { description: `$${data.amount.toFixed(2)} added to your wallet.` });
      setVoucherCode('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const validatePromoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/promotions/validate-code', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), depositAmount: parseFloat(depositAmount) || 0 }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        setPromoValidation({
          valid: true, estimatedBonus: data.estimatedBonus,
          promotionId: data.promotion?.id, termsConditions: data.promotion?.termsConditions,
          name: data.promotion?.name,
        });
      } else {
        setPromoValidation({ valid: false, reason: data.reason });
      }
    },
    onError: () => setPromoValidation({ valid: false, reason: 'Validation failed. Try again.' }),
  });

  const applyPromoMutation = useMutation({
    mutationFn: async ({ depositTransactionId }: { depositTransactionId?: string }) => {
      const res = await fetch('/api/promotions/apply-code', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), depositTransactionId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: (data) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['my-bonuses'] });
      toast.success('Promo Code Applied!', { description: data.message });
      setPromoCode(''); setPromoValidation(null); setShowTermsModal(false); setTermsAccepted(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const claimBonusMutation = useMutation({
    mutationFn: async ({ promotionId, depositTransactionId }: { promotionId: number; depositTransactionId: string }) => {
      const res = await fetch('/api/promotions/claim', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ promotionId, depositTransactionId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: (data) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['my-bonuses'] });
      toast.success('Bonus Claimed!', { description: data.message });
      setPendingBonus(null); setShowTermsModal(false); setTermsAccepted(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: bonusHistory } = useQuery({
    queryKey: ['my-bonuses'],
    queryFn: async () => {
      const res = await fetch('/api/promotions/my-bonuses', { headers: authHeaders() });
      return res.json() as Promise<{ bonusBalance: number; transactions: Array<{ id: number; type: string; amount: number; description: string | null; promotionName: string | null; createdAt: string }> }>;
    },
  });

  const payoutSetupMutation = useMutation({
    mutationFn: () => savePayoutMethod(newPayoutMethod, newPayoutAccount),
    onSuccess: () => {
      invalidatePayout();
      toast.success('Payout method saved!', { description: 'Your withdrawal account is now set.' });
      setNewPayoutAccount('');
      setConfirmSetup(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => initiateWithdrawal(parseFloat(withdrawAmount)),
    onSuccess: () => {
      invalidate();
      toast.success('Withdrawal Requested', { description: 'Pending admin approval.' });
      setWithdrawAmount('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const selectedMethod = PAYOUT_METHODS.find(m => m.value === newPayoutMethod)!;
  const hasPayoutMethod = !!payoutData?.payoutMethod;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <WalletIcon className="h-5 w-5 text-teal-400 shrink-0" />
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-white tracking-tight leading-tight">Wallet</h1>
          <p className="text-slate-400 text-xs sm:text-sm hidden sm:block">Manage your funds — deposit, withdraw, and track transactions.</p>
        </div>
      </div>

      {/* Pending payment banner */}
      {paymentStatus === 'pending' && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
          <span className="text-sm text-amber-300">Verifying your payment… this may take a few seconds.</span>
        </div>
      )}

      {/* Pending bonus banner */}
      {pendingBonus && !showTermsModal && (
        <div className="flex items-center gap-3 rounded-lg bg-purple-500/10 border border-purple-500/30 px-4 py-3 cursor-pointer"
          onClick={() => setShowTermsModal(true)}>
          <Gift className="h-5 w-5 text-purple-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-white font-semibold">🎁 You have a bonus waiting!</p>
            <p className="text-xs text-purple-300">Accept terms to claim your ${pendingBonus.estimatedBonus.toFixed(2)} bonus from "{pendingBonus.name}"</p>
          </div>
          <Button size="sm" className="bg-purple-500 hover:bg-purple-400 text-white h-8 text-xs gap-1 shrink-0">
            <Sparkles className="h-3.5 w-3.5" /> Claim
          </Button>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: 'Total Balance',  value: (wallet?.balance || 0) + (wallet?.bonusBalance || 0), color: 'text-teal-400' },
          { label: 'Cash Balance',   value: wallet?.availableBalance,    color: 'text-white' },
          { label: 'Bonus Balance',  value: wallet?.bonusBalance,        color: 'text-purple-400', icon: Gift },
          { label: 'Pending',        value: wallet?.pendingBalance,      color: 'text-amber-400' },
          { label: 'Withdrawable',   value: wallet?.withdrawableBalance, color: 'text-green-400' },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label} className={`bg-slate-900 border-primary/20 ${label === 'Bonus Balance' && (wallet?.bonusBalance || 0) > 0 ? 'border-purple-500/40' : ''}`}>
            <CardContent className="pt-3 pb-3 px-3 sm:pt-5 sm:pb-3 sm:px-4">
              {loadingWallet
                ? <Skeleton className="h-6 sm:h-7 w-20 bg-slate-800" />
                : <div className={`text-base sm:text-xl font-bold font-mono ${color} flex items-center gap-1`}>
                    {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
                    ${(value || 0).toFixed(2)}
                  </div>
              }
              <div className="text-slate-400 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{label}</div>
              {label === 'Bonus Balance' && <div className="text-[9px] text-purple-500 mt-0.5">Streaming only</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active bets locking funds */}
      {activeBetsCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-300 font-semibold">
              {activeBetsCount} active bet{activeBetsCount !== 1 ? 's' : ''} locking <span className="font-mono">${lockedAmount.toFixed(2)}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Funds are released when bets are settled, cancelled, or won.
            </p>
          </div>
          <Link href="/bets" className="shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1">
              <Ticket className="h-3 w-3" /> View Bets
            </Button>
          </Link>
        </div>
      )}

      {/* Deposit + Withdraw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">

        {/* ── Deposit ── */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2 sm:pb-3 pt-4 sm:pt-6 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-teal-400 text-base sm:text-lg">
              <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" /> Deposit
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => { if (pawapayEnabled) { setDepositTab('pawapay'); setPawapayDepositId(null); } }}
                disabled={!pawapayEnabled}
                title={!pawapayEnabled ? 'PawaPay is currently unavailable' : undefined}
                className={`flex-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold py-1.5 rounded-md transition-colors
                  ${!pawapayEnabled ? 'opacity-40 cursor-not-allowed text-slate-500' : depositTab === 'pawapay' ? 'bg-green-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                <Zap className="h-3 w-3" />
                PawaPay
                {!pawapayEnabled
                  ? <Badge className="bg-red-800/60 text-red-300 text-[8px] px-1 py-0 leading-none ml-0.5 hidden sm:inline-flex">Off</Badge>
                  : pawapayConfigured && <Badge className="bg-green-700 text-white text-[8px] px-1 py-0 leading-none ml-0.5 hidden sm:inline-flex">Preferred</Badge>
                }
              </button>
              <button
                onClick={() => { if (pesapalEnabled) setDepositTab('pesapal'); }}
                disabled={!pesapalEnabled}
                title={!pesapalEnabled ? 'Pesapal is currently unavailable' : undefined}
                className={`flex-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold py-1.5 rounded-md transition-colors
                  ${!pesapalEnabled ? 'opacity-40 cursor-not-allowed text-slate-500' : depositTab === 'pesapal' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                <CreditCard className="h-3 w-3" />
                Pesapal
                {!pesapalEnabled && <Badge className="bg-red-800/60 text-red-300 text-[8px] px-1 py-0 leading-none ml-0.5 hidden sm:inline-flex">Off</Badge>}
              </button>
              <button
                onClick={() => setDepositTab('voucher')}
                className={`flex-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold py-1.5 rounded-md transition-colors ${depositTab === 'voucher' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Ticket className="h-3 w-3" />
                Voucher
              </button>
            </div>

            {depositTab === 'pawapay' ? (
              <div className="space-y-3">
                {!pawapayEnabled ? (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-3 text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">PawaPay is temporarily unavailable</p>
                      <p className="text-red-400/80 mt-0.5">This payment method has been disabled. Please use Pesapal or a Voucher to deposit.</p>
                    </div>
                  </div>
                ) : !pawapayConfigured ? (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-3 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">PawaPay not configured</p>
                      <p className="text-amber-400/80 mt-0.5">An admin must add the PawaPay API token in Settings before this gateway is available.</p>
                    </div>
                  </div>
                ) : pawapayDepositId ? (
                  /* Awaiting phone confirmation */
                  <div className="space-y-4 py-2">
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="h-14 w-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center animate-pulse">
                        <Phone className="h-7 w-7 text-green-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-semibold text-sm">Check your phone!</p>
                        <p className="text-slate-400 text-xs mt-1">A mobile money prompt has been sent to <span className="text-white font-mono">{pawapayPhone}</span>.</p>
                        <p className="text-slate-500 text-[10px] mt-1">Approve the request to complete your deposit. This page updates automatically.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5 animate-spin" />
                      Waiting for confirmation…
                    </div>
                    <Button
                      onClick={() => { setPawapayDepositId(null); }}
                      variant="ghost"
                      size="sm"
                      className="w-full text-slate-500 hover:text-white h-8 text-xs"
                    >
                      Cancel / Try again
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs text-green-300 flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 shrink-0" />
                      Pay instantly with mobile money across Africa — MTN, Airtel, M-Pesa &amp; more.
                    </div>
                    {/* Quick amounts */}
                    <div className="flex gap-2">
                      {[{ amount: '1.50', label: 'Daily' }, { amount: '9.00', label: 'Weekly' }].map(({ amount, label }) => (
                        <button key={amount} onClick={() => setDepositAmount(amount)}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-left transition-all ${depositAmount === amount ? 'bg-green-500/20 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}>
                          <span className="font-bold text-sm font-mono">${amount}</span>
                          <span className={`text-[10px] font-medium ml-1.5 ${depositAmount === amount ? 'text-green-400' : 'text-slate-500'}`}>{label}</span>
                        </button>
                      ))}
                    </div>
                    {/* Amount */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-300 text-xs sm:text-sm">Amount (USD)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                        <Input type="number" min="1" step="0.01" placeholder="0.00"
                          value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white h-10 sm:h-11 font-mono pl-7" />
                      </div>
                    </div>
                    {/* Provider */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-300 text-xs sm:text-sm">Mobile Network</Label>
                      <select
                        value={pawapayProvider}
                        onChange={e => setPawapayProvider(e.target.value)}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 text-white text-sm h-10 px-3 focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        {PAWAPAY_PROVIDERS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* Phone */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-300 text-xs sm:text-sm">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                          type="tel" placeholder={PAWAPAY_PROVIDERS.find(p => p.value === pawapayProvider)?.hint || 'e.g. 0771234567'}
                          value={pawapayPhone} onChange={e => setPawapayPhone(e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white h-10 font-mono pl-9"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">Your registered mobile money number</p>
                    </div>
                    <Button
                      onClick={() => pawapayMutation.mutate()}
                      disabled={!depositAmount || parseFloat(depositAmount) < 1 || !pawapayPhone.trim() || pawapayMutation.isPending}
                      className="w-full bg-green-500 hover:bg-green-400 text-slate-950 font-bold h-10 sm:h-11 gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      {pawapayMutation.isPending ? 'Sending prompt…' : 'Pay with PawaPay'}
                    </Button>
                    <p className="text-[10px] text-slate-500 text-center">You will receive a mobile money prompt on your phone.</p>
                  </>
                )}
              </div>
            ) : depositTab === 'pesapal' ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-2 text-xs text-teal-300">
                  Pay securely via <strong>MTN MoMo, Airtel Money, Visa/Mastercard</strong> and more — powered by Pesapal.
                </div>
                {/* Quick-select amounts */}
                <div className="flex gap-2">
                  {[
                    { amount: '1.50', label: 'Daily', desc: '1 day' },
                    { amount: '9.00', label: 'Weekly', desc: '7 days' },
                  ].map(({ amount, label, desc }) => (
                    <button
                      key={amount}
                      onClick={() => setDepositAmount(amount)}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-left transition-all ${
                        depositAmount === amount
                          ? 'bg-teal-500/20 border-teal-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <span className="font-bold text-sm font-mono">${amount}</span>
                      <span className={`text-[10px] font-medium ml-1.5 ${depositAmount === amount ? 'text-teal-400' : 'text-slate-500'}`}>{label}</span>
                      <span className="text-[9px] text-slate-600 ml-1">· {desc}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs sm:text-sm">Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-base">$</span>
                    <Input
                      type="number" min="1" step="0.01" placeholder="0.00"
                      value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-10 sm:h-11 text-base font-mono pl-7"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Minimum deposit: $1.00</p>
                </div>
                <Button
                  onClick={() => pesapalMutation.mutate()}
                  disabled={!depositAmount || parseFloat(depositAmount) < 1 || pesapalMutation.isPending}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold h-10 sm:h-11 gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  {pesapalMutation.isPending ? 'Redirecting to Pesapal…' : 'Pay with Pesapal'}
                  {!pesapalMutation.isPending && <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-60" />}
                </Button>
                <p className="text-[10px] text-slate-500 text-center">You'll be redirected to Pesapal's secure payment page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-400">
                  Enter your 12-character ATA Voucher code to credit your wallet instantly.
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs sm:text-sm">Voucher Code</Label>
                  <Input
                    placeholder="XXXX-XXXX-XXXX" maxLength={14}
                    value={voucherCode}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
                      const fmt = raw.replace(/(.{4})(.{0,4})(.{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join('-'));
                      setVoucherCode(fmt);
                    }}
                    className="bg-slate-800 border-slate-700 text-white font-mono text-lg tracking-[0.25em] text-center h-10 sm:h-11 uppercase"
                  />
                  <p className="text-[10px] text-slate-500 text-center">12-character code from your ATA Voucher</p>
                </div>
                <Button
                  onClick={() => redeemMutation.mutate()}
                  disabled={voucherCode.replace(/-/g, '').length !== 12 || redeemMutation.isPending}
                  className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold h-9 sm:h-10"
                >
                  <Ticket className="h-4 w-4 mr-2" />
                  {redeemMutation.isPending ? 'Redeeming…' : 'Redeem Voucher'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Withdrawal ── */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2 sm:pb-3 pt-4 sm:pt-6 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-amber-400 text-base sm:text-lg">
              <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" /> Withdrawal
            </CardTitle>
            {pawapayConfigured && pawapayEnabled ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Zap className="h-3 w-3 text-amber-400" />
                <p className="text-xs text-amber-400 font-semibold">PawaPay instant withdrawal available — no admin approval</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">All withdrawals are reviewed and approved by admin</p>
            )}
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">

            {/* Withdrawal method tabs — only shown when PawaPay is configured AND enabled */}
            {pawapayConfigured && pawapayEnabled && (
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setWithdrawTab('pawapay')}
                  className={`flex-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold py-1.5 rounded-md transition-colors ${withdrawTab === 'pawapay' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  <Zap className="h-3 w-3" /> PawaPay (Instant)
                </button>
                <button
                  onClick={() => setWithdrawTab('standard')}
                  className={`flex-1 flex items-center justify-center gap-1 text-[11px] sm:text-xs font-semibold py-1.5 rounded-md transition-colors ${withdrawTab === 'standard' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                >
                  <Clock className="h-3 w-3" /> Standard
                </button>
              </div>
            )}

            {/* ── PawaPay instant withdrawal form ── */}
            {pawapayConfigured && pawapayEnabled && withdrawTab === 'pawapay' ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 shrink-0" />
                  Funds sent directly to your mobile money account across Africa — no waiting.
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs sm:text-sm">Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                    <Input
                      type="number" min="1" step="0.01" placeholder="0.00"
                      value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-10 font-mono pl-7"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Withdrawable: <span className="text-green-400 font-mono font-semibold">${(wallet?.withdrawableBalance || 0).toFixed(2)}</span>
                  </p>
                </div>

                {/* Network */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs sm:text-sm">Mobile Network</Label>
                  <select
                    value={pawapayWithdrawProvider}
                    onChange={e => setPawapayWithdrawProvider(e.target.value)}
                    className="w-full rounded-md bg-slate-800 border border-slate-700 text-white text-sm h-10 px-3 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    {PAWAPAY_PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs sm:text-sm">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      type="tel"
                      placeholder={PAWAPAY_PROVIDERS.find(p => p.value === pawapayWithdrawProvider)?.hint || 'e.g. 0771234567'}
                      value={pawapayWithdrawPhone}
                      onChange={e => setPawapayWithdrawPhone(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white h-10 font-mono pl-9"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Your registered mobile money number</p>
                </div>

                <Button
                  onClick={() => pawapayWithdrawMutation.mutate()}
                  disabled={
                    pawapayWithdrawMutation.isPending ||
                    !withdrawAmount || parseFloat(withdrawAmount) <= 0 ||
                    !pawapayWithdrawPhone.trim()
                  }
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-10 gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {pawapayWithdrawMutation.isPending ? 'Sending…' : 'Withdraw Instantly'}
                </Button>
                <p className="text-[10px] text-slate-500 text-center">Funds arrive in your mobile money account within minutes.</p>
              </div>
            ) : (
              /* ── Standard withdrawal (admin approval) ── */
              <>
              <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2 text-xs text-sky-300 flex items-center gap-2 mb-3">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                All requested payments are processed the following day before 11:00 AM EAT.
              </div>
              {loadingPayout ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 bg-slate-800 rounded-lg" />
                  <Skeleton className="h-10 bg-slate-800 rounded" />
                </div>
              ) : !hasPayoutMethod ? (
                /* No payout method — setup gate */
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-3 flex gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-300 space-y-1">
                      <p className="font-semibold">Payout method required</p>
                      <p>You must add a withdrawal account before requesting payouts. This can only be set <strong>once</strong> — choose carefully.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs sm:text-sm">Payout Method</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {PAYOUT_METHODS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => { setNewPayoutMethod(m.value); setNewPayoutAccount(''); setConfirmSetup(false); }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                            newPayoutMethod === m.value
                              ? 'bg-teal-500/10 border-teal-500/50 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          <m.icon className={`h-4 w-4 shrink-0 ${newPayoutMethod === m.value ? 'text-teal-400' : 'text-slate-500'}`} />
                          <span className="text-sm font-medium">{m.label}</span>
                          {newPayoutMethod === m.value && <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs sm:text-sm">{selectedMethod.label} Account</Label>
                    <Input
                      placeholder={selectedMethod.placeholder}
                      value={newPayoutAccount}
                      onChange={e => { setNewPayoutAccount(e.target.value); setConfirmSetup(false); }}
                      className="bg-slate-800 border-slate-700 text-white font-mono h-10"
                    />
                    <p className="text-[10px] text-slate-500">{selectedMethod.hint}</p>
                  </div>

                  {newPayoutAccount.trim() && !confirmSetup && (
                    <Button
                      onClick={() => setConfirmSetup(true)}
                      className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold h-9"
                      variant="outline"
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Review & Confirm
                    </Button>
                  )}

                  {confirmSetup && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
                      <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" /> Confirm your payout account
                      </p>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Method:</span>
                          <span className="font-medium">{METHOD_LABELS[newPayoutMethod]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Account:</span>
                          <span className="font-mono font-medium">{newPayoutAccount.trim()}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-400/80">⚠ This cannot be changed after saving. Contact admin if you need to update it.</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setConfirmSetup(false)}
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-slate-400 hover:text-white h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => payoutSetupMutation.mutate()}
                          disabled={payoutSetupMutation.isPending}
                          size="sm"
                          className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold h-8 text-xs"
                        >
                          <Lock className="h-3 w-3 mr-1" />
                          {payoutSetupMutation.isPending ? 'Saving…' : 'Save & Lock'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Payout method set — withdrawal form */
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                        <Lock className="h-3 w-3" /> Payout account (locked)
                      </div>
                      <div className="text-white font-medium text-sm">{METHOD_LABELS[payoutData.payoutMethod!] ?? payoutData.payoutMethod}</div>
                      <div className="text-slate-400 font-mono text-xs mt-0.5">{payoutData.payoutAccount}</div>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-teal-400 shrink-0" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs sm:text-sm">Amount (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-base">$</span>
                      <Input
                        type="number" min="1" step="0.01" placeholder="0.00"
                        value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white h-10 font-mono pl-7"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Withdrawable: <span className="text-green-400 font-mono font-semibold">${(wallet?.withdrawableBalance || 0).toFixed(2)}</span>
                    </p>
                  </div>

                  <Button
                    onClick={() => withdrawMutation.mutate()}
                    disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-10"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    {withdrawMutation.isPending ? 'Processing…' : 'Request Withdrawal'}
                  </Button>

                  <div className="rounded-md bg-slate-800/50 border border-slate-700/50 px-3 py-2 text-[10px] text-slate-500 flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                    Withdrawals are manually reviewed and approved by admin before funds are sent. To change your payout account, contact support.
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Promo Code + Bonus History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">

        {/* Promo Code Card */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2 pt-4 px-4 sm:pt-5 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-purple-400 text-sm sm:text-base">
              <Tag className="h-4 w-4" /> Promo Code
            </CardTitle>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Enter a promo code to earn bonus streaming credit</p>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. WELCOME50" maxLength={20}
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoValidation(null); }}
                className="bg-slate-800 border-slate-700 text-white font-mono uppercase h-9 text-sm tracking-wider flex-1"
              />
              <Button
                onClick={() => validatePromoMutation.mutate()}
                disabled={!promoCode.trim() || validatePromoMutation.isPending}
                className="bg-slate-700 hover:bg-slate-600 text-white h-9 px-3 text-xs shrink-0"
              >
                {validatePromoMutation.isPending ? '…' : 'Check'}
              </Button>
            </div>

            {promoValidation && !promoValidation.valid && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-red-300">{promoValidation.reason}</span>
              </div>
            )}

            {promoValidation?.valid && (
              <div className="rounded-md bg-purple-500/10 border border-purple-500/30 px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-purple-400 shrink-0" />
                  <div>
                    <p className="text-xs text-white font-semibold">{promoValidation.name}</p>
                    <p className="text-xs text-purple-300">Estimated bonus: <span className="font-bold font-mono">${promoValidation.estimatedBonus?.toFixed(2)}</span></p>
                  </div>
                </div>
                <Button
                  onClick={() => { setShowTermsModal(true); }}
                  className="w-full bg-purple-500 hover:bg-purple-400 text-white h-8 text-xs gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Accept Terms & Claim Bonus
                </Button>
              </div>
            )}

            <p className="text-[10px] text-slate-600">Bonus credit can only be used for live stream access. Cannot be withdrawn.</p>
          </CardContent>
        </Card>

        {/* Bonus History */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2 pt-4 px-4 sm:pt-5 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-purple-400 text-sm sm:text-base">
              <Gift className="h-4 w-4" /> Bonus History
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4 sm:pb-5">
            {!bonusHistory || bonusHistory.transactions.length === 0 ? (
              <div className="text-center py-6 text-slate-600">
                <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No bonus transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {bonusHistory.transactions.slice(0, 8).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-slate-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{tx.description || tx.promotionName || tx.type}</p>
                      <p className="text-[10px] text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className={`text-xs font-mono font-bold ml-2 shrink-0 ${tx.type === 'earned' || tx.type === 'promo_code_earned' ? 'text-purple-400' : tx.type === 'used' ? 'text-slate-400' : 'text-red-400'}`}>
                      {tx.type === 'earned' || tx.type === 'promo_code_earned' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions link */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-3 flex items-center justify-between">
        <span className="text-xs sm:text-sm text-slate-400">View your full transaction history.</span>
        <Link href="/transactions" className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors">
          Transactions →
        </Link>
      </div>

      {/* Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-xl max-w-md w-full shadow-2xl">
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-5 w-5 text-purple-400" />
                <h2 className="text-white font-bold text-base">Promotional Bonus Terms</h2>
              </div>
              <p className="text-slate-400 text-xs">
                {pendingBonus ? (
                  <>You've earned a <span className="text-purple-400 font-bold">${pendingBonus.estimatedBonus.toFixed(2)}</span> bonus from "{pendingBonus.name}"</>
                ) : promoValidation?.valid ? (
                  <>Claim your <span className="text-purple-400 font-bold">${promoValidation.estimatedBonus?.toFixed(2)}</span> bonus from "{promoValidation.name}"</>
                ) : null}
              </p>
            </div>

            <div className="p-5 space-y-3">
              <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-2">
                {[
                  'Bonus funds cannot be withdrawn.',
                  'Bonus funds cannot be transferred.',
                  'Bonus funds cannot be used for betting.',
                  'Bonus funds may only be used to purchase ATA Sports livestream access.',
                  'ATA may revoke bonuses obtained through abuse or fraud.',
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </div>
                ))}
                {(pendingBonus?.termsConditions || promoValidation?.termsConditions) && (
                  <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400 whitespace-pre-wrap text-[11px]">
                    {pendingBonus?.termsConditions || promoValidation?.termsConditions}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 accent-purple-500" />
                <span className="text-xs text-slate-300">I understand and agree to the Promotional Bonus Terms.</span>
              </label>

              <div className="flex gap-2 pt-1">
                <Button variant="ghost" onClick={() => { setShowTermsModal(false); setTermsAccepted(false); }}
                  className="flex-1 text-slate-400 hover:text-white h-9 text-xs">
                  Cancel
                </Button>
                <Button
                  disabled={!termsAccepted || claimBonusMutation.isPending || applyPromoMutation.isPending}
                  onClick={() => {
                    if (pendingBonus) {
                      claimBonusMutation.mutate({ promotionId: pendingBonus.promotionId, depositTransactionId: pendingBonus.depositTransactionId });
                    } else if (promoValidation?.valid) {
                      applyPromoMutation.mutate({});
                    }
                  }}
                  className="flex-1 bg-purple-500 hover:bg-purple-400 text-white h-9 text-xs gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {claimBonusMutation.isPending || applyPromoMutation.isPending ? 'Claiming…' : 'Accept & Claim Bonus'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
