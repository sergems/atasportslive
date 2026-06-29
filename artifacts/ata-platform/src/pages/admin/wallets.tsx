import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useListPendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, CheckCircle, XCircle, CreditCard, Search } from 'lucide-react';
import { toast } from 'sonner';
import { getListPendingWithdrawalsQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo', airtel_money: 'Airtel Money', btc_binance: 'Bitcoin',
};

function authHeaders() {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchUsers() {
  const res = await fetch('/api/users', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

async function adjustWallet(userId: number, type: 'credit' | 'debit', amount: number, note: string) {
  const res = await fetch(`/api/admin/wallets/${userId}/adjust`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type, amount, note }),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
  return res.json();
}

export default function AdminWallets() {
  useEffect(() => { document.title = 'Wallet Management - Admin'; }, []);

  const queryClient = useQueryClient();
  const { data: withdrawals, isLoading } = useListPendingWithdrawals();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  const { data: users } = useQuery({ queryKey: ['admin-users-list'], queryFn: fetchUsers });

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const invalidateWithdrawals = () => queryClient.invalidateQueries({ queryKey: getListPendingWithdrawalsQueryKey() });

  const handleApprove = async (id: number) => {
    try { await approve.mutateAsync({ id }); invalidateWithdrawals(); toast.success('Withdrawal approved'); }
    catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const handleReject = async (id: number) => {
    try { await reject.mutateAsync({ id }); invalidateWithdrawals(); toast.success('Withdrawal rejected, funds returned'); }
    catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const adjust = useMutation({
    mutationFn: () => adjustWallet(Number(selectedUserId), adjustType, parseFloat(adjustAmount), adjustNote),
    onSuccess: () => {
      toast.success(`Account ${adjustType === 'credit' ? 'credited' : 'debited'} successfully`);
      setAdjustAmount('');
      setAdjustNote('');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const userList: any[] = Array.isArray(users) ? users : (users as any)?.users || [];
  const filteredUsers = userSearch
    ? userList.filter((u: any) => u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
    : userList;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Wallet className="h-6 w-6 text-green-400" /> Wallet Management</h1>

      {/* Credit / Debit */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader><CardTitle className="text-white text-base flex items-center gap-2"><CreditCard className="h-5 w-5 text-teal-400" /> Credit / Debit Account</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Search & Select User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-9 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              {userSearch && filteredUsers.length > 0 && !selectedUserId && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {filteredUsers.slice(0, 8).map((u: any) => (
                    <button key={u.id} onClick={() => { setSelectedUserId(String(u.id)); setUserSearch(`${u.fullName} (${u.email})`); }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-slate-700 flex justify-between items-center">
                      <span>{u.fullName}</span>
                      <span className="text-slate-400 text-xs">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUserId && (
                <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-slate-300 h-6 px-2"
                  onClick={() => { setSelectedUserId(''); setUserSearch(''); }}>Clear selection</Button>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Type</Label>
                <Select value={adjustType} onValueChange={v => setAdjustType(v as 'credit' | 'debit')}>
                  <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="credit" className="text-teal-400">Credit (+)</SelectItem>
                    <SelectItem value="debit" className="text-red-400">Debit (−)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">Amount (USD)</Label>
                <Input
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  className="w-32 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="flex-1 min-w-48 space-y-1.5">
                <Label className="text-slate-400 text-xs">Note (optional)</Label>
                <Input placeholder="Reason for adjustment…" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
            </div>

            <Button
              onClick={() => adjust.mutate()}
              disabled={!selectedUserId || !adjustAmount || adjust.isPending}
              className={adjustType === 'credit'
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}
            >
              {adjust.isPending ? 'Processing…' : adjustType === 'credit' ? `Credit $${adjustAmount || '0.00'}` : `Debit $${adjustAmount || '0.00'}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending withdrawals */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader>
          <CardTitle className="text-white">
            Pending Withdrawals{' '}
            {withdrawals?.length ? <Badge className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30">{withdrawals.length}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 bg-slate-800 rounded" />)}</div>
          ) : !withdrawals?.length ? (
            <p className="text-slate-500 text-sm text-center py-8">No pending withdrawals.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                  <div>
                    <div className="text-white font-semibold">{tx.userFullName || `User #${tx.userId}`}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod} · {tx.reference}</div>
                    <div className="text-slate-500 text-xs">{new Date(tx.createdAt).toLocaleString()} · {tx.transactionId}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-amber-400 font-mono font-bold text-lg">${tx.amount.toFixed(2)}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(tx.id)} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 h-8">
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(tx.id)} className="h-8">
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
