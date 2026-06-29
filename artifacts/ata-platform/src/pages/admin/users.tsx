import React, { useEffect, useState } from 'react';
import { useListUsers, useUpdateUserRole, useSuspendUser } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, Search, Ban, Lock, Smartphone, Bitcoin,
  CheckCircle2, Pencil, X, ShieldCheck, Mail, ChevronDown, ChevronUp, Send,
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

  const selectedM = PAYOUT_METHODS.find(m => m.value === method)!;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-teal-400" /> Edit Payout Method
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 bg-slate-700 rounded" />
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Method</Label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {PAYOUT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Account / Number / Address</Label>
            <Input
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder={method === 'btc_binance' ? 'Bitcoin address' : 'Mobile number'}
              className="bg-slate-700 border-slate-600 text-white font-mono text-sm h-9"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} className="flex-1 text-slate-400 h-8 text-xs">Cancel</Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!account.trim() || saveMutation.isPending}
              className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold h-8 text-xs"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </>
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
      toast.success(`Sent ${d.sent} activation email${d.sent !== 1 ? 's' : ''}${d.failed ? `, ${d.failed} failed` : ''}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const count = pending?.count ?? 0;

  return (
    <Card className="bg-slate-900 border-amber-500/30">
      <CardContent className="p-4">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Mail className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Activation Emails</div>
              <div className="text-slate-400 text-xs">
                {count === 0
                  ? 'All imported users have activated their accounts'
                  : <><span className="text-amber-400 font-semibold">{count.toLocaleString()}</span> imported users haven't set a password yet</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {count > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border text-xs">
                {count.toLocaleString()} pending
              </Badge>
            )}
            {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </div>
        </button>

        {open && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
            <p className="text-slate-400 text-xs leading-relaxed">
              Send each pending user a personalised email with a one-click link to{' '}
              <code className="bg-slate-800 px-1 py-0.5 rounded text-teal-400">/set-password</code>.
              Enter your outgoing mail (SMTP) credentials below — they are sent directly to the server and never stored.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">SMTP Host</Label>
                <Input
                  value={smtp.smtpHost}
                  onChange={e => setSmtp(s => ({ ...s, smtpHost: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Port</Label>
                <Input
                  value={smtp.smtpPort}
                  onChange={e => setSmtp(s => ({ ...s, smtpPort: e.target.value }))}
                  placeholder="587"
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">SMTP Username</Label>
                <Input
                  value={smtp.smtpUser}
                  onChange={e => setSmtp(s => ({ ...s, smtpUser: e.target.value }))}
                  placeholder="your@email.com"
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">SMTP Password</Label>
                <Input
                  type="password"
                  value={smtp.smtpPass}
                  onChange={e => setSmtp(s => ({ ...s, smtpPass: e.target.value }))}
                  placeholder="App password"
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">From Address</Label>
                <Input
                  value={smtp.smtpFrom}
                  onChange={e => setSmtp(s => ({ ...s, smtpFrom: e.target.value }))}
                  placeholder='"ATA Sports" <no-reply@atasportslive.com>'
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Site URL (in email links)</Label>
                <Input
                  value={smtp.siteUrl}
                  onChange={e => setSmtp(s => ({ ...s, siteUrl: e.target.value }))}
                  placeholder="https://atasportslive.com"
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
            </div>

            {result && (
              <div className="bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                <div className="flex gap-4">
                  <span className="text-teal-400 font-semibold">{result.sent} sent</span>
                  {result.failed > 0 && <span className="text-red-400 font-semibold">{result.failed} failed</span>}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <ul className="text-red-400 text-xs space-y-0.5 mt-1">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || count === 0 || !smtp.smtpHost || !smtp.smtpUser || !smtp.smtpPass || !smtp.smtpFrom}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2 h-9"
              >
                <Send className="h-4 w-4" />
                {sendMutation.isPending
                  ? 'Sending…'
                  : count === 0
                    ? 'No pending users'
                    : `Send to ${count.toLocaleString()} users`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminUsers() {
  useEffect(() => { document.title = 'Manage Users - Admin'; }, []);

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingPayoutFor, setEditingPayoutFor] = useState<number | null>(null);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-400" /> Manage Users
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 bg-slate-800 border-slate-700 text-white"
          />
        </div>
      </div>

      <ActivationEmailPanel />

      <Card className="bg-slate-900 border-primary/20">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800 rounded" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">User</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Role</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium hidden lg:table-cell">Payout Method</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium hidden md:table-cell">Joined</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users || []).map((user: any) => (
                  <React.Fragment key={user.id}>
                    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{user.fullName}</div>
                        <div className="text-slate-500 text-xs">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRole(user.id, e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                        >
                          <option value="user">User</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`border text-xs ${user.status === 'active' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <UserPayoutBadge userId={user.id} />
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs hidden md:table-cell">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingPayoutFor(editingPayoutFor === user.id ? null : user.id)}
                            className="h-7 text-xs text-teal-400 hover:bg-teal-500/10 gap-1"
                          >
                            {editingPayoutFor === user.id ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                            <span className="hidden sm:inline">{editingPayoutFor === user.id ? 'Cancel' : 'Payout'}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSuspend(user.id, user.status === 'active')}
                            className={`h-7 text-xs ${user.status === 'active' ? 'text-red-400 hover:bg-red-500/10' : 'text-teal-400 hover:bg-teal-500/10'}`}
                          >
                            {user.status === 'active' ? <><Ban className="h-3 w-3 mr-1" />Suspend</> : 'Reactivate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {editingPayoutFor === user.id && (
                      <tr className="border-b border-slate-800/50 bg-slate-800/20">
                        <td colSpan={6} className="px-4 pb-3">
                          <PayoutMethodEditor
                            userId={user.id}
                            onClose={() => setEditingPayoutFor(null)}
                            onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-payout', user.id] })}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
          {data && data.total > 20 && (
            <div className="flex justify-between items-center p-4 border-t border-slate-800">
              <span className="text-slate-400 text-sm">{data.total} total users</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-slate-400">Prev</Button>
                <span className="text-slate-400 text-sm py-1">Page {page}</span>
                <Button size="sm" variant="ghost" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= data.total} className="text-slate-400">Next</Button>
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

  if (isLoading) return <Skeleton className="h-5 w-24 bg-slate-800" />;
  if (!data?.payoutMethod) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
        <Lock className="h-3 w-3" /> Not set
      </span>
    );
  }
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-teal-400">
        <CheckCircle2 className="h-3 w-3" />
        {METHOD_LABELS[data.payoutMethod] ?? data.payoutMethod}
      </div>
      <div className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">{data.payoutAccount}</div>
    </div>
  );
}
