import React, { useEffect, useState } from 'react';
import { useGetWallet } from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, Ticket, Wallet as WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getGetWalletQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';
import { Link } from 'wouter';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
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

async function initiateWithdrawal(amount: number, paymentMethod: string, accountDetails: string) {
  const res = await fetch('/api/wallet/withdraw', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, paymentMethod, accountDetails }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
  return data;
}

const PAYMENT_METHODS = [
  { value: 'mtn_momo', label: 'MTN MoMo' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'btc_binance', label: 'Bitcoin (Binance)' },
];

export default function Wallet() {
  useEffect(() => { document.title = 'Wallet - ATA Platform'; }, []);

  const queryClient = useQueryClient();
  const { data: wallet, isLoading: loadingWallet } = useGetWallet();

  const [voucherCode, setVoucherCode] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('mtn_momo');
  const [withdrawDetails, setWithdrawDetails] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
  };

  const redeemMutation = useMutation({
    mutationFn: () => redeemVoucher(voucherCode.trim()),
    onSuccess: (data) => {
      invalidate();
      toast.success('Voucher Redeemed!', { description: `$${data.amount.toFixed(2)} added to your wallet.` });
      setVoucherCode('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => initiateWithdrawal(parseFloat(withdrawAmount), withdrawMethod, withdrawDetails),
    onSuccess: () => {
      invalidate();
      toast.success('Withdrawal Requested', { description: 'Pending admin approval.' });
      setWithdrawAmount('');
      setWithdrawDetails('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleWithdraw = () => {
    if (!parseFloat(withdrawAmount) || parseFloat(withdrawAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!withdrawDetails.trim()) { toast.error('Enter account details'); return; }
    withdrawMutation.mutate();
  };

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

      {/* Balance Cards — 2×2 on mobile, 4-col on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: 'Total Balance',  value: wallet?.balance,             color: 'text-teal-400' },
          { label: 'Available',      value: wallet?.availableBalance,    color: 'text-white' },
          { label: 'Pending',        value: wallet?.pendingBalance,      color: 'text-amber-400' },
          { label: 'Withdrawable',   value: wallet?.withdrawableBalance, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-slate-900 border-primary/20">
            <CardContent className="pt-3 pb-3 px-3 sm:pt-6 sm:pb-4 sm:px-4">
              {loadingWallet
                ? <Skeleton className="h-6 sm:h-8 w-20 bg-slate-800" />
                : <div className={`text-lg sm:text-2xl font-bold font-mono ${color}`}>${(value || 0).toFixed(2)}</div>
              }
              <div className="text-slate-400 text-[10px] sm:text-sm mt-0.5 sm:mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deposit + Withdraw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">

        {/* ── Deposit ── */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2 sm:pb-3 pt-4 sm:pt-6 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-teal-400 text-base sm:text-lg">
              <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" /> Deposit
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Redeem an ATA Voucher to load funds instantly</p>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-2 text-xs sm:text-sm text-teal-300">
              Enter your 6-digit ATA Voucher code to credit your wallet immediately.
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs sm:text-sm">Voucher Code</Label>
              <Input
                placeholder="e.g. 228623"
                maxLength={6}
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.replace(/\D/g, ''))}
                className="bg-slate-800 border-slate-700 text-white font-mono text-xl tracking-[0.3em] text-center h-10 sm:h-11"
              />
              <p className="text-[10px] text-slate-500 text-center">6-digit code printed on your ATA Voucher</p>
            </div>
            <Button
              onClick={() => redeemMutation.mutate()}
              disabled={voucherCode.length !== 6 || redeemMutation.isPending}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold h-9 sm:h-10"
            >
              <Ticket className="h-4 w-4 mr-2" />
              {redeemMutation.isPending ? 'Redeeming…' : 'Redeem Voucher'}
            </Button>
          </CardContent>
        </Card>

        {/* ── Withdraw ── */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-2 sm:pb-3 pt-4 sm:pt-6 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-amber-400 text-base sm:text-lg">
              <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" /> Withdrawal
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Request a payout to your mobile money or crypto account</p>
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
            {/* Amount + method on the same row on mobile */}
            <div className="grid grid-cols-2 gap-2 sm:block sm:space-y-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs sm:text-sm">Amount (USD)</Label>
                <Input
                  type="number" min="1" step="0.01" placeholder="0.00"
                  value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white h-9 sm:h-10"
                />
                <p className="text-[10px] text-slate-500 hidden sm:block">
                  Withdrawable: <span className="text-green-400 font-mono font-semibold">${(wallet?.withdrawableBalance || 0).toFixed(2)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs sm:text-sm">Method</Label>
                <select
                  value={withdrawMethod} onChange={e => setWithdrawMethod(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-2 text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 h-9 sm:h-10"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            {/* Withdrawable shown below amount on mobile */}
            <p className="text-[10px] text-slate-500 sm:hidden -mt-1">
              Withdrawable: <span className="text-green-400 font-mono font-semibold">${(wallet?.withdrawableBalance || 0).toFixed(2)}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs sm:text-sm">Account Details</Label>
              <Input
                placeholder="e.g. 0771234567 or crypto address"
                value={withdrawDetails} onChange={e => setWithdrawDetails(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-9 sm:h-10"
              />
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-9 sm:h-10"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              {withdrawMutation.isPending ? 'Processing…' : 'Request Withdrawal'}
            </Button>
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
    </div>
  );
}
