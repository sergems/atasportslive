import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Gift, Plus, Pencil, Trash2, X, TrendingUp, DollarSign,
  CheckCircle2, Clock, PauseCircle, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface Promotion {
  id: number;
  name: string;
  code: string | null;
  type: string;
  bonusType: string;
  percentage: number | null;
  fixedAmount: number | null;
  minDeposit: number;
  maxBonus: number | null;
  maxUses: number | null;
  usedCount: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  description: string | null;
  termsConditions: string | null;
  bonusExpiryDays: number | null;
  createdAt: string;
}

interface PromoStats {
  total: number;
  active: number;
  totalBonusIssued: number;
  totalBonusUsed: number;
  totalBonusRevoked: number;
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-teal-500/20 text-teal-400 border-teal-500/30',
  draft:     'bg-slate-500/20 text-slate-400 border-slate-500/30',
  paused:    'bg-amber-500/20 text-amber-400 border-amber-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  expired:   'bg-red-500/20 text-red-400 border-red-500/30',
};

const BLANK_FORM = {
  name: '', code: '', type: 'automatic', bonusType: 'percentage',
  percentage: '50', fixedAmount: '', minDeposit: '5', maxBonus: '',
  maxUses: '', startDate: '', endDate: '',
  status: 'draft', description: '', termsConditions:
    'Bonus funds cannot be withdrawn. Bonus funds can only be used to purchase ATA Sports livestream access. ATA may revoke bonuses obtained through abuse or fraud.',
  bonusExpiryDays: '30',
};

export default function AdminPromotions() {
  useEffect(() => { document.title = 'Promotions - Admin'; }, []);

  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(BLANK_FORM);

  const { data: promos = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promotions', { headers: authHeaders() });
      return res.json();
    },
  });

  const { data: stats } = useQuery<PromoStats>({
    queryKey: ['admin-promo-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promotions/stats', { headers: authHeaders() });
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          percentage: form.percentage ? Number(form.percentage) : null,
          fixedAmount: form.fixedAmount ? Number(form.fixedAmount) : null,
          minDeposit: Number(form.minDeposit) || 0,
          maxBonus: form.maxBonus ? Number(form.maxBonus) : null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          bonusExpiryDays: form.bonusExpiryDays ? Number(form.bonusExpiryDays) : null,
          code: form.code.trim().toUpperCase() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      toast.success(editing ? 'Promotion updated' : 'Promotion created');
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
      qc.invalidateQueries({ queryKey: ['admin-promo-stats'] });
      setShowForm(false);
      setEditing(null);
      setForm(BLANK_FORM);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success('Promotion deleted');
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
      qc.invalidateQueries({ queryKey: ['admin-promo-stats'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  function openEdit(p: Promotion) {
    setEditing(p);
    setForm({
      name: p.name, code: p.code || '', type: p.type, bonusType: p.bonusType,
      percentage: p.percentage?.toString() || '', fixedAmount: p.fixedAmount?.toString() || '',
      minDeposit: p.minDeposit?.toString() || '0', maxBonus: p.maxBonus?.toString() || '',
      maxUses: p.maxUses?.toString() || '', startDate: p.startDate?.slice(0, 16) || '',
      endDate: p.endDate?.slice(0, 16) || '', status: p.status,
      description: p.description || '', termsConditions: p.termsConditions || '',
      bonusExpiryDays: p.bonusExpiryDays?.toString() || '',
    });
    setShowForm(true);
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(s => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gift className="h-6 w-6 text-purple-400" /> Promotions & Bonuses
        </h1>
        <Button onClick={() => { setEditing(null); setForm(BLANK_FORM); setShowForm(true); }}
          className="bg-purple-500 hover:bg-purple-400 text-white gap-2">
          <Plus className="h-4 w-4" /> New Promotion
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Promotions', value: stats?.total ?? '—', icon: Gift, color: 'text-purple-400' },
          { label: 'Active', value: stats?.active ?? '—', icon: CheckCircle2, color: 'text-teal-400' },
          { label: 'Bonus Issued', value: stats ? `$${stats.totalBonusIssued.toFixed(2)}` : '—', icon: DollarSign, color: 'text-green-400' },
          { label: 'Bonus Used', value: stats ? `$${stats.totalBonusUsed.toFixed(2)}` : '—', icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Bonus Revoked', value: stats ? `$${stats.totalBonusRevoked.toFixed(2)}` : '—', icon: X, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-slate-400 text-xs">{label}</span>
              </div>
              <div className="text-white font-bold text-lg">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-slate-900 border-purple-500/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">
                {editing ? 'Edit Promotion' : 'Create New Promotion'}
              </CardTitle>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 md:col-span-1 space-y-1">
                <Label className="text-slate-400 text-xs">Promotion Name *</Label>
                <Input value={form.name} onChange={f('name')} placeholder="50% Deposit Bonus" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Promo Code (optional)</Label>
                <Input value={form.code} onChange={f('code')} placeholder="WELCOME50" className="bg-slate-800 border-slate-700 text-white h-8 text-sm font-mono uppercase" />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Type</Label>
                <select value={form.type} onChange={f('type')} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm">
                  <option value="automatic">Automatic (on every deposit)</option>
                  <option value="promo_code">Promo Code only</option>
                  <option value="welcome">Welcome Bonus (first deposit)</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="deposit_match">Deposit Match</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Status</Label>
                <select value={form.status} onChange={f('status')} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Bonus Type</Label>
                <select value={form.bonusType} onChange={f('bonusType')} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm">
                  <option value="percentage">Percentage of deposit</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              {form.bonusType === 'percentage' ? (
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Bonus %</Label>
                  <Input type="number" value={form.percentage} onChange={f('percentage')} placeholder="50" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Fixed Bonus ($)</Label>
                  <Input type="number" value={form.fixedAmount} onChange={f('fixedAmount')} placeholder="10.00" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Min Deposit ($)</Label>
                <Input type="number" value={form.minDeposit} onChange={f('minDeposit')} placeholder="5.00" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Max Bonus ($, leave blank = unlimited)</Label>
                <Input type="number" value={form.maxBonus} onChange={f('maxBonus')} placeholder="50.00" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Max Uses (leave blank = unlimited)</Label>
                <Input type="number" value={form.maxUses} onChange={f('maxUses')} placeholder="1000" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Bonus Expiry (days, blank = never)</Label>
                <Input type="number" value={form.bonusExpiryDays} onChange={f('bonusExpiryDays')} placeholder="30" className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Start Date</Label>
                <Input type="datetime-local" value={form.startDate} onChange={f('startDate')} className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">End Date</Label>
                <Input type="datetime-local" value={form.endDate} onChange={f('endDate')} className="bg-slate-800 border-slate-700 text-white h-8 text-sm" />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-slate-400 text-xs">Description</Label>
                <textarea value={form.description} onChange={f('description')}
                  rows={2} placeholder="Short description shown to users..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-slate-400 text-xs">Terms & Conditions</Label>
                <textarea value={form.termsConditions} onChange={f('termsConditions')}
                  rows={3} placeholder="Bonus funds cannot be withdrawn..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400 h-9">Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name}
                className="bg-purple-500 hover:bg-purple-400 text-white gap-2 h-9">
                {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Promotion'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 bg-slate-800 rounded" />)}</div>
          ) : promos.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Gift className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No promotions yet. Create your first one!</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Promotion</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium hidden md:table-cell">Bonus</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium hidden lg:table-cell">Period</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Uses</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{p.name}</div>
                      {p.code && <div className="text-xs font-mono text-purple-400">{p.code}</div>}
                      <div className="text-xs text-slate-500">{p.type.replace('_', ' ')}</div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="text-teal-400 font-semibold">
                        {p.bonusType === 'percentage' ? `${p.percentage}%` : `$${p.fixedAmount}`}
                      </div>
                      {p.maxBonus && <div className="text-slate-500 text-xs">max ${p.maxBonus}</div>}
                      <div className="text-slate-500 text-xs">min dep ${p.minDeposit}</div>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell text-slate-400 text-xs">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}
                      {' → '}
                      {p.endDate ? new Date(p.endDate).toLocaleDateString() : '∞'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-white">{p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`border text-xs ${STATUS_STYLES[p.status] || STATUS_STYLES.draft}`}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}
                          className="h-7 text-xs text-teal-400 hover:bg-teal-500/10 gap-1">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm('Delete this promotion?')) deleteMutation.mutate(p.id); }}
                          className="h-7 text-xs text-red-400 hover:bg-red-500/10">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
