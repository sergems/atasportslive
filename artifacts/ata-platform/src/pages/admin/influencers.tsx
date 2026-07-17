import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Crown, ChevronDown, ChevronUp, Users, DollarSign, Link2, X, Pencil, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

function authHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

interface Influencer {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  referralCode: string;
  status: string;
  createdAt: string;
  referralCount: number;
  totalCommissionEarned: number;
  isSuperInfluencer: boolean;
  superInfluencerCommissionRate: number | null;
}

interface Referral {
  id: number;
  fullName: string;
  username: string | null;
  email: string;
  status: string;
  createdAt: string;
  totalSubscriptionSpend: number;
}

function ReferralPanel({ influencer, onClose }: { influencer: Influencer; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-influencer-referrals', influencer.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/influencers/${influencer.id}/referrals`, {
        headers: authHeaders(),
      });
      return res.json() as Promise<{ referrals: Referral[]; total: number }>;
    },
  });

  return (
    <div className="mt-2 bg-slate-950 border border-teal-500/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Referrals for {influencer.fullName}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 bg-slate-800 rounded" />)}
        </div>
      ) : !data?.referrals?.length ? (
        <p className="text-xs text-slate-500 py-2 text-center">No referrals yet</p>
      ) : (
        <div className="space-y-1">
          {data.referrals.map((ref) => (
            <div key={ref.id} className="flex items-center justify-between bg-slate-900 rounded px-2.5 py-1.5 gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{ref.fullName}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {ref.username ? `@${ref.username}` : ref.email}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-right">
                <div>
                  <p className="text-[10px] text-slate-500">Spent</p>
                  <p className="text-xs font-mono text-amber-400">${ref.totalSubscriptionSpend.toFixed(2)}</p>
                </div>
                <Badge
                  className={`text-[9px] h-4 px-1.5 ${
                    ref.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}
                >
                  {ref.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RateEditor({ influencer, onSaved }: { influencer: Influencer; onSaved: (rate: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [rateInput, setRateInput] = useState(
    influencer.superInfluencerCommissionRate != null
      ? String(influencer.superInfluencerCommissionRate)
      : ''
  );

  const saveMutation = useMutation({
    mutationFn: async (rate: number) => {
      const res = await fetch(`/api/admin/users/${influencer.id}/super-influencer-rate`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: (_, rate) => {
      toast.success(`Commission rate set to ${rate}%`);
      setEditing(false);
      onSaved(rate);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    const val = parseFloat(rateInput);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Enter a valid rate between 0 and 100');
      return;
    }
    saveMutation.mutate(val);
  };

  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 font-mono transition-colors"
        title="Edit commission rate"
      >
        <span className="font-semibold">
          {influencer.superInfluencerCommissionRate != null
            ? `${influencer.superInfluencerCommissionRate}% rate`
            : 'Set rate'}
        </span>
        <Pencil className="h-2.5 w-2.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        value={rateInput}
        onChange={(e) => setRateInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        className="h-5 w-16 text-[10px] px-1.5 bg-slate-950 border-purple-500/40 text-white font-mono"
        placeholder="e.g. 40"
        autoFocus
      />
      <span className="text-[10px] text-slate-500">%</span>
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
      >
        <Check className="h-3 w-3" />
      </button>
      <button onClick={() => setEditing(false)} className="text-slate-500 hover:text-slate-300">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function AdminInfluencers() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  // Local rate overrides after saving (influencerId → rate)
  const [rateOverrides, setRateOverrides] = useState<Record<number, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-influencers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/influencers', { headers: authHeaders() });
      return res.json() as Promise<Influencer[]>;
    },
  });

  const influencers = Array.isArray(data) ? data : [];

  const superCount = influencers.filter(i => i.isSuperInfluencer).length;
  const totalCommission = influencers.reduce((s, i) => s + i.totalCommissionEarned, 0);
  const totalReferrals = influencers.reduce((s, i) => s + i.referralCount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Star className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Influencers</h1>
          <p className="text-slate-400 text-sm mt-0.5">Influencers and Super Influencers with referral codes</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Influencers', value: isLoading ? '—' : influencers.length, icon: Star, color: 'text-amber-400' },
          { label: 'Super Influencers', value: isLoading ? '—' : superCount, icon: Crown, color: 'text-purple-400' },
          { label: 'Total Referrals', value: isLoading ? '—' : totalReferrals, icon: Users, color: 'text-teal-400' },
          { label: 'Commission Paid Out', value: isLoading ? '—' : `${totalCommission.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900 border-slate-700">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-slate-800 ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Influencer list */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" /> All Influencers
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Click any row to see referrals. Super Influencers have personalised commission rates — click the rate to edit.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800 rounded" />)}
            </div>
          ) : influencers.length === 0 ? (
            <div className="p-8 text-center">
              <Star className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No influencers yet</p>
              <p className="text-slate-600 text-xs mt-1">
                Go to Manage Users and toggle the ⭐ or 👑 button on a user.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {influencers.map((inf) => {
                const effectiveRate = rateOverrides[inf.id] !== undefined
                  ? rateOverrides[inf.id]
                  : inf.superInfluencerCommissionRate;
                const displayInf = { ...inf, superInfluencerCommissionRate: effectiveRate ?? null };
                return (
                  <div key={inf.id}>
                    <button
                      onClick={() => setExpandedId(expandedId === inf.id ? null : inf.id)}
                      className="w-full text-left px-3 py-3 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Avatar icon — purple crown for super, amber star for regular */}
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                            inf.isSuperInfluencer
                              ? 'bg-purple-500/20 border border-purple-500/30'
                              : 'bg-amber-500/20 border border-amber-500/30'
                          }`}>
                            {inf.isSuperInfluencer
                              ? <Crown className="h-3.5 w-3.5 text-purple-400" />
                              : <Star className="h-3.5 w-3.5 text-amber-400" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-white truncate">{inf.fullName}</p>
                              {inf.isSuperInfluencer && (
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px] h-4 px-1.5 shrink-0">
                                  SUPER
                                </Badge>
                              )}
                              {inf.status === 'suspended' && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px] h-4 px-1 shrink-0">suspended</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[10px] text-slate-500">{inf.username ? `@${inf.username}` : inf.email}</p>
                              <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: inf.isSuperInfluencer ? '#c084fc' : '#5eead4' }}>
                                <Link2 className="h-2.5 w-2.5" />{inf.referralCode}
                              </span>
                              {inf.isSuperInfluencer && (
                                <RateEditor
                                  influencer={displayInf}
                                  onSaved={(rate) => {
                                    setRateOverrides(prev => ({ ...prev, [inf.id]: rate }));
                                    queryClient.invalidateQueries({ queryKey: ['admin-influencers'] });
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500">Referrals</p>
                            <p className="text-sm font-bold text-teal-400">{inf.referralCount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500">Earned</p>
                            <p className="text-sm font-bold text-emerald-400 font-mono">${inf.totalCommissionEarned.toFixed(2)}</p>
                          </div>
                          {expandedId === inf.id ? (
                            <ChevronUp className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {expandedId === inf.id && (
                      <div className="px-3 pb-3">
                        <ReferralPanel
                          influencer={inf}
                          onClose={() => setExpandedId(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
