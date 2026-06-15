import React, { useEffect, useState } from 'react';
import { useGetWallet, useListTransactions } from '@workspace/api-client-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet as WalletIcon, ArrowUpRight, History, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { getGetWalletQueryKey, getListTransactionsQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

const TX_COLORS: Record<string, string> = {
  deposit: 'text-teal-400',
  withdrawal: 'text-red-400',
  bet_stake: 'text-amber-400',
  bet_win: 'text-teal-400',
  bet_refund: 'text-blue-400',
  brokerage_fee: 'text-slate-400',
  stream_access: 'text-purple-400',
  voucher_redeem: 'text-teal-400',
  admin_credit: 'text-teal-400',
  admin_debit: 'text-red-400',
};

const TX_SIGN: Record<string, string> = {
  deposit: '+', withdrawal: '-', bet_stake: '-', bet_win: '+',
  bet_refund: '+', stream_access: '-', brokerage_fee: '-',
  voucher_redeem: '+', admin_credit: '+', admin_debit: '-',
};

const TX_LABELS: Record<string, string> = {
  deposit: 'Deposit', withdrawal: 'Withdrawal', bet_stake: 'Bet Placed',
  bet_win: 'Bet Won', bet_refund: 'Bet Refund', stream_access: 'Stream Access',
  brokerage_fee: 'Brokerage Fee', voucher_redeem: 'Voucher Redeemed',
  admin_credit: 'Admin Credit', admin_debit: 'Admin Debit',
};

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
  const { data: txData, isLoading: loadingTx } = useListTransactions({ limit: 20 });

  const [voucherCode, setVoucherCode] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('mtn_momo');
  const [withdrawDetails, setWithdrawDetails] = useState('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
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
        <p className="text-slate-400 mt-1">Manage your funds — redeem vouchers, withdraw, and track transactions.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deposit / Withdraw form */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader>
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'deposit' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('deposit')}
                className={activeTab === 'deposit' ? 'bg-teal-500 text-slate-950 hover:bg-teal-400' : 'text-slate-400'}
              >
                <Ticket className="h-4 w-4 mr-1" /> Redeem Voucher
              </Button>
              <Button
                variant={activeTab === 'withdraw' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('withdraw')}
                className={activeTab === 'withdraw' ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'text-slate-400'}
              >
                <ArrowUpRight className="h-4 w-4 mr-1" /> Withdraw
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === 'deposit' ? (
              <>
                <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-4 py-3 text-sm text-teal-300">
                  Enter your ATA Voucher code to load funds into your wallet instantly.
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
                  {redeemMutation.isPending ? 'Redeeming…' : 'Redeem Voucher'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-300">Amount (USD)</Label>
                  <Input
                    type="number" min="1" step="0.01" placeholder="0.00"
                    value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <p className="text-xs text-slate-500">Withdrawable: ${(wallet?.withdrawableBalance || 0).toFixed(2)}</p>
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
                </div>
                <Button
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {withdrawMutation.isPending ? 'Processing…' : 'Request Withdrawal'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <History className="h-5 w-5" /> Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTx ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800" />)}</div>
            ) : !txData?.transactions?.length ? (
              <p className="text-slate-500 text-sm text-center py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {txData.transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-0">
                    <div>
                      <div className="text-sm text-white">{TX_LABELS[tx.type] || tx.type.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-semibold text-sm ${TX_COLORS[tx.type] || 'text-white'}`}>
                        {TX_SIGN[tx.type] || ''}${tx.amount.toFixed(2)}
                      </div>
                      <Badge variant="outline" className={`text-[10px] border-slate-700 ${tx.status === 'completed' ? 'text-teal-400' : tx.status === 'pending' ? 'text-amber-400' : 'text-red-400'}`}>
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
