import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useListUsers, useUpdateUserRole, useSuspendUser } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Search, Ban, Lock, Smartphone, Bitcoin,
  CheckCircle2, Pencil, X, ShieldCheck, Mail, ChevronDown, ChevronUp, Send, DollarSign, Wallet, KeyRound,
  History, TrendingUp, TrendingDown, ArrowLeftRight, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { getListUsersQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const PAYOUT_METHODS = [
  { value: 'mtn_momo',     label: 'MTN MoMo',         icon: Smartphone },
  { value: 'airtel_money', label: 'Airtel Money',      icon: Smartphone },
  { value: 'btc_binance',  label: 'Bitcoin (Binance)', icon: Bitcoin },
];

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  btc_binance: 'Bitcoin',
};

function PayoutMethodEditor({ userId, onClose, onSaved }: { userId: number; onClose: () => void; onSaved: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payout', userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/payout-method`, { headers: authHeaders() });
      return res.json() as Promise<{ payoutMethod: string | null; payoutAccount: string | null }>;
    },
  });

  const [method, setMethod] = useState('mtn_momo');
  const [account, setAccount] = useState('');

  useEffect(() => {
    if (data) {
      setMethod(data.payoutMethod || 'mtn_momo');
      setAccount(data.payoutAccount || '');
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${userId}/payout-method`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ payoutMethod: method, payoutAccount: account }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      toast.success('Payout method updated');
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-slate-900 border border-teal-500/30 rounded p-3 space-y-2 mt-2 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Edit Payout Method
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
      {isLoading ? (
        <Skeleton className="h-16 bg-slate-800 rounded" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Method</Label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 h-8 text-white text-xs focus:outline-none focus:ring-1 focus:ring-teal-500/50"
            >
              {PAYOUT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Account / Number</Label>
            <Input
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder={method === 'btc_binance' ? 'Bitcoin address' : 'Mobile number'}
              className="bg-slate-950 border-slate-800 text-white font-mono text-xs h-8 focus-visible:ring-1 focus-visible:ring-teal-500/50"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 px-3 text-xs">Cancel</Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!account.trim() || saveMutation.isPending}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold h-7 px-4 text-xs"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivationEmailPanel() {
  const [open, setOpen] = useState(false);
  const [smtp, setSmtp] = useState({
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '', siteUrl: 'https://atasportslive.com',
  });
  const [result, setResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null);

  const { data: pending, refetch: refetchPending } = useQuery({
    queryKey: ['admin-pending-activation'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pending-activation', { headers: authHeaders() });
      return res.json() as Promise<{ count: number }>;
    },
    staleTime: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/notify-pending', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(smtp),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d as { sent: number; failed: number; errors?: string[] };
    },
    onSuccess: (d) => {
      setResult(d);
      refetchPending();
      toast.success(`Sent ${d.sent} email${d.sent !== 1 ? 's' : ''}${d.failed ? `, ${d.failed} failed` : ''}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const count = pending?.count ?? 0;

  if (count === 0 && !open) return null; // hide if empty, unless already open

  return (
    <Card className="bg-slate-900 border-amber-500/30">
      <CardContent className="p-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-amber-500/20 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
              <Mail className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div>
              <div className="text-white font-bold text-xs uppercase tracking-wider">Activation Emails</div>
              <div className="text-slate-400 text-[10px]">
                {count === 0
                  ? 'All users activated'
                  : <><span className="text-amber-400 font-bold">{count.toLocaleString()}</span> imported users need passwords</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {count > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border text-[10px] px-1.5 py-0">
                {count.toLocaleString()} pending
              </Badge>
            )}
            {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </div>
        </button>

        {open && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
            <p className="text-slate-400 text-[10px] leading-tight max-w-2xl">
              Send an activation link to pending users. Enter SMTP credentials below (sent directly to server, not stored).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">SMTP Host</Label>
                <Input value={smtp.smtpHost} onChange={e => setSmtp(s => ({ ...s, smtpHost: e.target.value }))} placeholder="smtp.gmail.com" className="bg-slate-950 border-slate-800 text-white text-xs h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Port</Label>
                <Input value={smtp.smtpPort} onChange={e => setSmtp(s => ({ ...s, smtpPort: e.target.value }))} placeholder="587" className="bg-slate-950 border-slate-800 text-white text-xs h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Username</Label>
                <Input value={smtp.smtpUser} onChange={e => setSmtp(s => ({ ...s, smtpUser: e.target.value }))} placeholder="your@email.com" className="bg-slate-950 border-slate-800 text-white text-xs h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Password</Label>
                <Input type="password" value={smtp.smtpPass} onChange={e => setSmtp(s => ({ ...s, smtpPass: e.target.value }))} placeholder="App pass" className="bg-slate-950 border-slate-800 text-white text-xs h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">From Address</Label>
                <Input value={smtp.smtpFrom} onChange={e => setSmtp(s => ({ ...s, smtpFrom: e.target.value }))} placeholder="no-reply@..." className="bg-slate-950 border-slate-800 text-white text-xs h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Site URL</Label>
                <Input value={smtp.siteUrl} onChange={e => setSmtp(s => ({ ...s, siteUrl: e.target.value }))} placeholder="https://..." className="bg-slate-950 border-slate-800 text-white text-xs h-7" />
              </div>
            </div>

            {result && (
              <div className="bg-slate-950 border border-slate-800 rounded p-2 text-[10px]">
                <div className="flex gap-3 font-mono">
                  <span className="text-teal-400 font-bold">{result.sent} sent</span>
                  {result.failed > 0 && <span className="text-red-400 font-bold">{result.failed} failed</span>}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <ul className="text-red-400 mt-1 list-disc pl-3">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || count === 0 || !smtp.smtpHost || !smtp.smtpUser || !smtp.smtpPass || !smtp.smtpFrom}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold h-7 px-3 text-xs"
              >
                {sendMutation.isPending ? 'Sending…' : count === 0 ? 'No pending users' : `Send to ${count.toLocaleString()}`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResetPasswordPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ newPassword: password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => { toast.success('Password reset successfully'); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !mutation.isPending;

  return (
    <div className="bg-slate-900 border border-blue-500/30 rounded p-3 mt-2 shadow-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" /> Reset Password
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-slate-400 text-[10px] uppercase tracking-wider">New Password</Label>
          <Input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="bg-slate-950 border-slate-800 text-white text-xs h-8 focus-visible:ring-1 focus-visible:ring-blue-500/50"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Confirm Password</Label>
          <Input
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className={`bg-slate-950 border-slate-800 text-white text-xs h-8 focus-visible:ring-1 ${mismatch ? 'border-red-500/50 focus-visible:ring-red-500/50' : 'focus-visible:ring-blue-500/50'}`}
          />
          {mismatch && <p className="text-red-400 text-[10px]">Passwords do not match</p>}
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 mt-1">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 px-3 text-xs">Cancel</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={!canSubmit}
            className="bg-blue-500 hover:bg-blue-400 text-white font-bold h-7 px-4 text-xs">
            {mutation.isPending ? 'Saving…' : 'Reset Password'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WalletAdjustPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/wallet/admin/adjust', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId, amount: parseFloat(amount), type, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => { 
      toast.success(`Wallet ${type}ed successfully`); 
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      onClose(); 
    },
    onError: (e: any) => toast.error(e.message || 'Failed'),
  });

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded p-3 mt-2 shadow-lg flex flex-col sm:flex-row gap-2 items-end">
      <div className="space-y-1 w-full sm:w-24 shrink-0">
        <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Action</Label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="w-full bg-slate-950 border border-slate-800 rounded px-2 h-7 text-white text-xs font-bold focus-visible:ring-1 focus-visible:ring-teal-500/50"
        >
          <option value="credit">CREDIT</option>
          <option value="debit">DEBIT</option>
        </select>
      </div>
      <div className="space-y-1 w-full sm:w-32 shrink-0">
        <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Amount ($)</Label>
        <Input
          type="number" min="0.01" step="0.01"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="bg-slate-950 border-slate-800 text-white font-mono text-xs h-7 focus-visible:ring-1 focus-visible:ring-teal-500/50"
        />
      </div>
      <div className="space-y-1 w-full sm:flex-1">
        <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Note (opt)</Label>
        <Input
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Refund"
          className="bg-slate-950 border-slate-800 text-white text-xs h-7 focus-visible:ring-1 focus-visible:ring-teal-500/50"
        />
      </div>
      <div className="flex gap-1.5 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 px-2 text-xs text-slate-400 hover:text-white flex-1 sm:flex-none">Cancel</Button>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !amount || parseFloat(amount) <= 0}
          className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wider flex-1 sm:flex-none ${type === 'credit' ? 'bg-teal-500 hover:bg-teal-400 text-slate-950' : 'bg-red-500 hover:bg-red-400 text-white'}`}
        >
          {mutation.isPending ? '…' : type === 'credit' ? 'Apply Credit' : 'Apply Debit'}
        </Button>
      </div>
    </div>
  );
}

// ── UserWalletBadge — always-visible balance strip ──────────────────────────

function UserWalletBadge({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-wallet', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/wallet`, { headers: authHeaders() });
      if (!res.ok) return null;
      return res.json() as Promise<{ balance: number; availableBalance: number; bonusBalance: number }>;
    },
    staleTime: 30_000,
  });

  if (isLoading) return <Skeleton className="h-3.5 w-28 bg-slate-800 inline-block align-middle rounded" />;
  if (!data) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px]">
      <Wallet className="h-2.5 w-2.5 text-teal-400 shrink-0" />
      <span className="font-mono font-bold text-teal-300">${data.balance.toFixed(2)}</span>
      {data.bonusBalance > 0 && (
        <span className="font-mono text-amber-400">+${data.bonusBalance.toFixed(2)} bonus</span>
      )}
    </span>
  );
}

// ── UserTransactionsPanel — expandable history ───────────────────────────────

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  stream_access: 'Stream Access',
  brokerage_fee: 'Brokerage Fee',
  admin_credit: 'Admin Credit',
  admin_debit: 'Admin Debit',
  bonus_credit: 'Bonus Credit',
  bonus_used: 'Bonus Used',
  bet_placed: 'Bet Placed',
  bet_won: 'Bet Won',
  bet_refund: 'Bet Refund',
  voucher_redeem: 'Voucher',
};

function txIcon(type: string) {
  if (type === 'deposit' || type === 'admin_credit' || type === 'bonus_credit' || type === 'bet_won' || type === 'bet_refund' || type === 'voucher_redeem')
    return <TrendingUp className="h-3 w-3 text-teal-400" />;
  if (type === 'withdrawal' || type === 'admin_debit' || type === 'bonus_used' || type === 'bet_placed' || type === 'stream_access' || type === 'brokerage_fee')
    return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <ArrowLeftRight className="h-3 w-3 text-slate-400" />;
}

function txAmountColor(type: string) {
  if (type === 'deposit' || type === 'admin_credit' || type === 'bonus_credit' || type === 'bet_won' || type === 'bet_refund' || type === 'voucher_redeem')
    return 'text-teal-400';
  return 'text-red-400';
}

function txAmountPrefix(type: string) {
  if (type === 'deposit' || type === 'admin_credit' || type === 'bonus_credit' || type === 'bet_won' || type === 'bet_refund' || type === 'voucher_redeem')
    return '+';
  return '-';
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  failed:    'bg-red-500/15 text-red-400 border-red-500/30',
  approved:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

function UserTransactionsPanel({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-user-txs', userId, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/transactions?page=${page}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load transactions');
      return res.json() as Promise<{
        transactions: Array<{
          id: number; transactionId: string; type: string; amount: number;
          status: string; description: string | null; paymentMethod: string | null;
          reference: string | null; createdAt: string;
        }>;
        total: number;
        page: number;
      }>;
    },
    staleTime: 15_000,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="bg-slate-950 border border-slate-700 rounded mt-2 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
            Transaction History
          </span>
          <span className="text-[10px] text-slate-500">— {userName}</span>
          {data && (
            <span className="text-[10px] text-slate-600">({data.total} total)</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Transactions */}
      {isLoading ? (
        <div className="p-3 space-y-1.5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 bg-slate-800 rounded" />)}
        </div>
      ) : !data?.transactions.length ? (
        <div className="flex flex-col items-center gap-1.5 py-8 text-slate-500">
          <AlertCircle className="h-5 w-5" />
          <span className="text-[10px]">No transactions found</span>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {data.transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-900/60 transition-colors">
              {/* Icon */}
              <div className="shrink-0">{txIcon(tx.type)}</div>

              {/* Type + description */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-slate-200 truncate">
                  {TX_TYPE_LABELS[tx.type] ?? tx.type}
                  {tx.paymentMethod && tx.paymentMethod !== 'internal' && (
                    <span className="text-slate-500 font-normal ml-1">via {tx.paymentMethod}</span>
                  )}
                </div>
                {tx.description && (
                  <div className="text-[9px] text-slate-500 truncate">{tx.description}</div>
                )}
                {tx.transactionId && (
                  <div className="text-[9px] text-slate-600 font-mono">{tx.transactionId}</div>
                )}
              </div>

              {/* Status */}
              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider border rounded px-1 py-0 ${STATUS_STYLE[tx.status] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {tx.status}
              </span>

              {/* Amount */}
              <span className={`shrink-0 font-mono font-bold text-[11px] ${txAmountColor(tx.type)}`}>
                {txAmountPrefix(tx.type)}${tx.amount.toFixed(2)}
              </span>

              {/* Date */}
              <span className="shrink-0 text-[9px] text-slate-500 tabular-nums w-20 text-right">
                {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                <br />
                <span className="text-slate-600">{new Date(tx.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800 bg-slate-900/50">
          <span className="text-[9px] text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="h-5 w-5 p-0 text-slate-400 hover:text-white hover:bg-slate-800">
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="h-5 w-5 p-0 text-slate-400 hover:text-white hover:bg-slate-800">
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  useEffect(() => { document.title = 'Manage Users - Admin'; }, []);

  const { canManageUsers, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingPayoutFor, setEditingPayoutFor] = useState<number | null>(null);
  const [walletAdjustFor, setWalletAdjustFor] = useState<number | null>(null);
  const [resetPasswordFor, setResetPasswordFor] = useState<number | null>(null);
  const [txHistoryFor, setTxHistoryFor] = useState<number | null>(null);

  const { data, isLoading } = useListUsers({ page, limit: 20, search: search || undefined });
  const updateRole = useUpdateUserRole();
  const suspend = useSuspendUser();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleRole = async (id: number, role: string) => {
    try {
      await updateRole.mutateAsync({ id, data: { role: role as any } });
      invalidate();
      toast.success('Role updated');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const handleSuspend = async (id: number, suspended: boolean) => {
    try {
      await suspend.mutateAsync({ id, data: { suspended } });
      invalidate();
      toast.success(suspended ? 'User suspended' : 'User reactivated');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-400" /> User Management
        </h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users..."
            className="pl-8 bg-slate-900 border-slate-800 text-white text-xs h-8 focus-visible:ring-1 focus-visible:ring-teal-500/50"
          />
        </div>
      </div>

      <ActivationEmailPanel />

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800 rounded" />)}</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {(data?.users || []).map((user: any) => (
                <div key={user.id} className="p-3 hover:bg-slate-800/50 transition-colors flex flex-col gap-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`px-1.5 py-0 rounded border text-[9px] font-bold uppercase tracking-wider ${user.status === 'active' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                          {user.status}
                        </span>
                        <span className="text-white font-semibold text-xs truncate max-w-[150px] sm:max-w-[200px]">
                          {user.fullName || `User #${user.id}`}
                        </span>
                        <span className="text-slate-500 text-[10px] truncate max-w-[150px]">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] flex-wrap">
                        <span className="text-slate-500">ID: {user.id}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                        <span className="text-slate-600">·</span>
                        <UserPayoutBadge userId={user.id} />
                        {canManageUsers && (
                          <>
                            <span className="text-slate-600">·</span>
                            <UserWalletBadge userId={user.id} />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions & Role — managers and admins only */}
                    {canManageUsers && (
                    <div className="flex items-center gap-2 shrink-0 md:justify-end">
                      <select
                        value={user.role}
                        onChange={(e) => handleRole(user.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0 h-6 text-slate-300 text-[10px] font-semibold uppercase tracking-wider focus:outline-none"
                      >
                        <option value="user">USER</option>
                        <option value="content_editor">CONTENT EDITOR</option>
                        <option value="manager">MANAGER</option>
                        {isAdmin && <option value="admin">ADMIN</option>}
                      </select>

                      <div className="flex items-center gap-1 bg-slate-950 rounded border border-slate-800 p-0.5">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { setTxHistoryFor(txHistoryFor === user.id ? null : user.id); setWalletAdjustFor(null); setEditingPayoutFor(null); setResetPasswordFor(null); }}
                          className={`h-5 w-6 p-0 rounded-sm ${txHistoryFor === user.id ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'}`}
                          title="View Transaction History"
                        >
                          <History className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { setWalletAdjustFor(walletAdjustFor === user.id ? null : user.id); setEditingPayoutFor(null); setResetPasswordFor(null); setTxHistoryFor(null); }}
                          className={`h-5 w-6 p-0 rounded-sm ${walletAdjustFor === user.id ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'}`}
                          title="Adjust Wallet"
                        >
                          <Wallet className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { setEditingPayoutFor(editingPayoutFor === user.id ? null : user.id); setWalletAdjustFor(null); setResetPasswordFor(null); setTxHistoryFor(null); }}
                          className={`h-5 w-6 p-0 rounded-sm ${editingPayoutFor === user.id ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-teal-400 hover:bg-slate-800'}`}
                          title="Edit Payout Method"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {isAdmin && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { setResetPasswordFor(resetPasswordFor === user.id ? null : user.id); setWalletAdjustFor(null); setEditingPayoutFor(null); setTxHistoryFor(null); }}
                          className={`h-5 w-6 p-0 rounded-sm ${resetPasswordFor === user.id ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'}`}
                          title="Reset Password"
                        >
                          <KeyRound className="h-3 w-3" />
                        </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => handleSuspend(user.id, user.status === 'active')}
                          className={`h-5 w-6 p-0 rounded-sm ${user.status === 'active' ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'bg-red-500/20 text-red-400'}`}
                          title={user.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                        >
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    )}

                  </div>

                  {/* Inline Panels */}
                  {txHistoryFor === user.id && (
                    <UserTransactionsPanel
                      userId={user.id}
                      userName={user.fullName || `User #${user.id}`}
                      onClose={() => setTxHistoryFor(null)}
                    />
                  )}
                  {walletAdjustFor === user.id && (
                    <WalletAdjustPanel userId={user.id} onClose={() => setWalletAdjustFor(null)} />
                  )}
                  {editingPayoutFor === user.id && (
                    <PayoutMethodEditor
                      userId={user.id}
                      onClose={() => setEditingPayoutFor(null)}
                      onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-payout', user.id] })}
                    />
                  )}
                  {resetPasswordFor === user.id && (
                    <ResetPasswordPanel userId={user.id} onClose={() => setResetPasswordFor(null)} />
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="flex items-center justify-between p-2 border-t border-slate-800 bg-slate-900/50">
              <span className="text-[10px] text-slate-500">Page {page} of {Math.ceil(data.total / 20)} · {data.total} total</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-6 px-2 text-[10px] border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700">Prev</Button>
                <Button size="sm" variant="outline" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}
                  className="h-6 px-2 text-[10px] border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserPayoutBadge({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-payout', userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/payout-method`, { headers: authHeaders() });
      return res.json() as Promise<{ payoutMethod: string | null; payoutAccount: string | null }>;
    },
    staleTime: 30_000,
  });

  if (isLoading) return <Skeleton className="h-3 w-16 bg-slate-800 inline-block align-middle" />;
  
  if (!data?.payoutMethod) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-600">
        <Lock className="h-2.5 w-2.5" /> None
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 text-teal-400/80">
      <CheckCircle2 className="h-2.5 w-2.5" />
      {METHOD_LABELS[data.payoutMethod] ?? data.payoutMethod}
      {data.payoutAccount && <span className="text-slate-500 font-mono">({data.payoutAccount.slice(-4)})</span>}
    </span>
  );
}
