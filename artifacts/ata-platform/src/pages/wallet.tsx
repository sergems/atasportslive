import React, { useEffect, useState } from 'react';
import { useGetWallet } from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { getGetWalletQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Wallet</h1>
        <p className="text-slate-400 mt-1">Manage your funds — deposit, withdraw, and track transactions.</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Balance', value: wallet?.balance, color: 'text-teal-400' },
          { label: 'Available', value: wallet?.availableBalance, color: 'text-white' },
          { label: 'Pending', value: wallet?.pendingBalance, color: 'text-amber-400' },
          { label: 'Withdrawable', value: wallet?.withdrawableBalance, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="bg-slate-900 border-primary/20">
            <CardContent className="pt-6">
              {loadingWallet
                ? <Skeleton className="h-8 w-24 bg-slate-800" />
                : <div className={`text-2xl font-bold font-mono ${color}`}>${(value || 0).toFixed(2)}</div>
              }
              <div className="text-slate-400 text-sm mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deposit + Withdraw side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Deposit ── */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-teal-400">
              <ArrowDownLeft className="h-5 w-5" /> Deposit
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Redeem an ATA Voucher to load funds instantly</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-4 py-3 text-sm text-teal-300">
              Enter your 6-digit ATA Voucher code to credit your wallet immediately.
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Voucher Code</Label>
              <Input
                placeholder="e.g. 228623"
                maxLength={6}
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value.replace(/\D/g, ''))}
                className="bg-slate-800 border-slate-700 text-white font-mono text-xl tracking-[0.3em] text-center"
              />
              <p className="text-xs text-slate-500 text-center">6-digit code printed on your ATA Voucher</p>
            </div>
            <Button
              onClick={() => redeemMutation.mutate()}
              disabled={voucherCode.length !== 6 || redeemMutation.isPending}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
            >
              <Ticket className="h-4 w-4 mr-2" />
              {redeemMutation.isPending ? 'Redeeming…' : 'Redeem Voucher'}
            </Button>
          </CardContent>
        </Card>

        {/* ── Withdraw ── */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <ArrowUpRight className="h-5 w-5" /> Withdrawal
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Request a payout to your mobile money or crypto account</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Amount (USD)</Label>
              <Input
                type="number" min="1" step="0.01" placeholder="0.00"
                value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                Withdrawable balance: <span className="text-green-400 font-mono font-semibold">${(wallet?.withdrawableBalance || 0).toFixed(2)}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Payment Method</Label>
              <select
                value={withdrawMethod} onChange={e => setWithdrawMethod(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Account Details</Label>
              <Input
                placeholder="e.g. 0771234567"
                value={withdrawDetails} onChange={e => setWithdrawDetails(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">Enter your mobile number or crypto address</p>
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              {withdrawMutation.isPending ? 'Processing…' : 'Request Withdrawal'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-5 py-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">View your full deposit, withdrawal, and betting transaction history.</span>
        <a href="/transactions" className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors">
          View Transactions →
        </a>
      </div>
    </div>
  );
}
