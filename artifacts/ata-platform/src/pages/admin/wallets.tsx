import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useListPendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Wallet className="h-5 w-5 text-green-400" /> Wallet Adjustments
        </h1>
      </div>

      {/* Credit / Debit */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="py-2 px-3 border-b border-slate-800">
          <CardTitle className="text-white text-xs uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-teal-400" /> Credit / Debit Account
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Search & Select User</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-8 bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50"
                />
              </div>
              {userSearch && filteredUsers.length > 0 && !selectedUserId && (
                <div className="bg-slate-950 border border-slate-800 rounded mt-1 overflow-hidden max-h-40 overflow-y-auto">
                  {filteredUsers.slice(0, 8).map((u: any) => (
                    <button key={u.id} onClick={() => { setSelectedUserId(String(u.id)); setUserSearch(`${u.fullName} (${u.email})`); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-slate-800 flex justify-between items-center transition-colors">
                      <span className="font-medium truncate mr-2">{u.fullName}</span>
                      <span className="text-slate-500 text-[10px] truncate">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUserId && (
                <div className="flex justify-end pt-1">
                  <Button variant="ghost" size="sm" className="text-[10px] text-slate-500 hover:text-white h-5 px-1.5"
                    onClick={() => { setSelectedUserId(''); setUserSearch(''); }}>Clear selection</Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1 w-full sm:w-28 shrink-0">
                <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Type</Label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as 'credit' | 'debit')}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 h-8 text-white text-xs font-bold focus-visible:ring-1 focus-visible:ring-teal-500/50 outline-none"
                >
                  <option value="credit">CREDIT (+)</option>
                  <option value="debit">DEBIT (-)</option>
                </select>
              </div>
              <div className="space-y-1 w-full sm:w-32 shrink-0">
                <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Amount (USD)</Label>
                <Input
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  className="w-full bg-slate-950 border-slate-800 text-white font-mono text-xs h-8 focus-visible:ring-1 focus-visible:ring-teal-500/50"
                />
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Note (opt)</Label>
                <Input placeholder="Reason for adjustment…" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                  className="w-full bg-slate-950 border-slate-800 text-white text-xs h-8 focus-visible:ring-1 focus-visible:ring-teal-500/50" />
              </div>
              <Button
                size="sm"
                onClick={() => adjust.mutate()}
                disabled={!selectedUserId || !adjustAmount || adjust.isPending}
                className={`h-8 px-4 text-xs font-bold w-full sm:w-auto mt-1 sm:mt-0 ${adjustType === 'credit'
                  ? 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                  : 'bg-red-500 hover:bg-red-400 text-white'}`}
              >
                {adjust.isPending ? 'Processing…' : adjustType === 'credit' ? `Credit ${adjustAmount || '0.00'}` : `Debit ${adjustAmount || '0.00'}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending withdrawals */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="py-2 px-3 border-b border-slate-800 flex flex-row justify-between items-center">
          <CardTitle className="text-white text-xs uppercase tracking-wider">
            Pending Withdrawals
          </CardTitle>
          {withdrawals?.length ? <span className="min-w-[18px] h-4 px-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center justify-center">{withdrawals.length}</span> : null}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800 rounded" />)}</div>
          ) : !withdrawals?.length ? (
            <p className="text-slate-500 text-xs text-center py-6">No pending withdrawals.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {withdrawals.map((tx: any) => (
                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 hover:bg-slate-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-white font-semibold text-xs truncate max-w-[150px]">{tx.userFullName || `User #${tx.userId}`}</span>
                      <span className="text-slate-500 text-[10px] truncate max-w-[150px]">· {METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}</span>
                      <span className="text-slate-600 text-[10px] font-mono truncate">· {tx.reference}</span>
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      {new Date(tx.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} · <span className="font-mono">{tx.transactionId}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-1 sm:mt-0">
                    <div className="text-amber-400 font-mono font-bold text-sm shrink-0">${tx.amount.toFixed(2)}</div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => handleApprove(tx.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-full" title="Approve">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReject(tx.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full" title="Reject">
                        <XCircle className="h-4 w-4" />
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
