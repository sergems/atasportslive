import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetWallet } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { useAuthStore } from '@/lib/auth-store';
import { useLocation } from 'wouter';
import {
  Check, Crown, Zap, Calendar, CalendarDays, Sparkles,
  Wallet, AlertTriangle, Clock, Shield, XCircle, Loader2,
  Radio, CheckCircle2, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

// ── API helpers ───────────────────────────────────────────────────────────

async function fetchPrices(): Promise<Record<string, number>> {
  const r = await fetch('/api/subscriptions/prices');
  if (!r.ok) throw new Error('Failed to load prices');
  return r.json();
}

async function fetchActive(): Promise<{
  hasSubscription: boolean;
  subscriptionType?: string;
  expiresAt?: string;
  secondsRemaining?: number;
}> {
  const token = useAuthStore.getState().token;
  const r = await fetch('/api/subscriptions/active', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error('Failed to check subscription');
  return r.json();
}

function friendlyError(raw: string | undefined): string {
  if (!raw) return 'Purchase failed. Please try again.';
  const msg = raw.toLowerCase();
  if (msg.includes('no token') || msg.includes('invalid') || msg.includes('expired token') || msg.includes('unauthorized'))
    return 'Not enough funds in your wallet. Please top up and try again.';
  if (msg.includes('insufficient') || msg.includes('balance'))
    return 'Not enough funds in your wallet. Please top up and try again.';
  if (msg.includes('already have an active'))
    return 'You already have an active subscription. It must expire before purchasing a new one.';
  return raw;
}

async function purchaseSubscription(subscriptionType: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const r = await fetch('/api/subscriptions/purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ subscriptionType }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(friendlyError(data.error));
  return data;
}

// ── Plan definitions ──────────────────────────────────────────────────────

const PLAN_META = {
  daily: {
    label: 'Daily',
    icon: Zap,
    duration: '24 hours',
    description: 'Perfect for catching a single event',
    color: 'from-slate-700 to-slate-800',
    accent: 'text-slate-300',
    border: 'border-slate-700',
    badge: null as string | null,
    savings: null as string | null,
  },
  weekly: {
    label: 'Weekly',
    icon: Calendar,
    duration: '7 days',
    description: 'Full week of unlimited access',
    color: 'from-teal-900/60 to-slate-800',
    accent: 'text-teal-400',
    border: 'border-teal-700/50',
    badge: null as string | null,
    savings: null as string | null,
  },
  monthly: {
    label: 'Monthly',
    icon: CalendarDays,
    duration: '30 days',
    description: 'Best for regular fans',
    color: 'from-amber-900/40 to-slate-800',
    accent: 'text-amber-400',
    border: 'border-amber-600/50',
    badge: 'POPULAR' as string | null,
    savings: null as string | null,
  },
  yearly: {
    label: 'Yearly',
    icon: Crown,
    duration: '365 days',
    description: 'Ultimate access, maximum savings',
    color: 'from-violet-900/50 to-slate-800',
    accent: 'text-violet-400',
    border: 'border-violet-600/50',
    badge: 'BEST VALUE' as string | null,
    savings: null as string | null,
  },
};

const PLAN_FEATURES = [
  'Access to all live streams',
  'Watch any event during your plan',
  'HD quality streaming',
  'Real-time match updates',
  'Community chat access',
];

// ── Countdown helper ──────────────────────────────────────────────────────

function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

const PLAN_TOTAL_SECONDS: Record<string, number> = {
  daily:   86_400,
  weekly:  604_800,
  monthly: 2_592_000,
  yearly:  31_536_000,
};

// ── Page component ────────────────────────────────────────────────────────

export default function Subscriptions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['subscription-prices'],
    queryFn: fetchPrices,
    staleTime: 5 * 60_000,
  });

  const { data: active, isLoading: activeLoading } = useQuery({
    queryKey: ['subscription-active'],
    queryFn: fetchActive,
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: wallet } = useGetWallet({
    query: {
      enabled: !!user,
      queryKey: ['wallet'],
      refetchInterval: 15_000,
    },
  });

  const mutation = useMutation({
    mutationFn: purchaseSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-active'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      setPendingPlan(null);
      setDialogError(null);
      setLocation('/live');
    },
    onError: (err: any) => {
      setDialogError(err?.message || 'Purchase failed. Please try again.');
    },
  });

  const handleConfirm = () => {
    if (!pendingPlan) return;
    setDialogError(null);
    mutation.mutate(pendingPlan);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !mutation.isPending) {
      setPendingPlan(null);
      setDialogError(null);
    }
  };

  // Compute per-day cost for savings badges
  const dailyPrice = prices?.daily ?? 1.70;
  if (prices) {
    PLAN_META.weekly.savings = `Save ${Math.round((1 - prices.weekly / (dailyPrice * 7)) * 100)}% vs daily`;
    PLAN_META.monthly.savings = `Save ${Math.round((1 - prices.monthly / (dailyPrice * 30)) * 100)}% vs daily`;
    PLAN_META.yearly.savings = `Save ${Math.round((1 - prices.yearly / (dailyPrice * 365)) * 100)}% vs daily`;
  }

  const isLoading = pricesLoading || activeLoading;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 pt-1">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-bold uppercase tracking-widest shrink-0">
          <Sparkles className="h-3 w-3" />
          Platform Access
        </div>
        <h1 className="text-base font-bold text-white tracking-tight">Choose Your Plan</h1>
        <span className="text-slate-500 text-xs hidden sm:inline">· Deducted from wallet instantly</span>
      </div>

      {/* ── Subscription status card ────────────────────────────────────── */}
      {activeLoading ? (
        <div className="h-40 rounded-2xl bg-slate-800/50 animate-pulse" />
      ) : active?.hasSubscription ? (() => {
        const planKey = active.subscriptionType as keyof typeof PLAN_META;
        const meta = PLAN_META[planKey];
        const Icon = meta?.icon ?? Shield;
        const totalSec = PLAN_TOTAL_SECONDS[planKey] ?? PLAN_TOTAL_SECONDS.daily;
        const remaining = active.secondsRemaining ?? 0;
        const usedPct = Math.max(0, Math.min(100, Math.round((1 - remaining / totalSec) * 100)));
        const expiryDate = active.expiresAt
          ? new Date(active.expiresAt).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null;

        return (
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-950/50 via-slate-900 to-slate-900 px-5 py-4">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl" />
            <div className="relative flex items-center gap-4">
              {/* Icon */}
              <div className="shrink-0 w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-teal-400" />
              </div>

              {/* Middle: name + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-sm">{meta?.label ?? planKey} Plan</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-400 text-[9px] font-bold uppercase tracking-widest">
                    <CheckCircle2 className="h-2 w-2" /> Active
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-teal-400 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />{formatTimeLeft(remaining)}
                  </span>
                  {expiryDate && (
                    <span className="text-[10px] text-slate-500">Expires {expiryDate}</span>
                  )}
                </div>
              </div>

              {/* Watch Live */}
              <a href="/live" className="shrink-0">
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs px-3 py-1.5 transition-all active:scale-95 cursor-pointer">
                  <Radio className="h-3.5 w-3.5" /> Watch
                </div>
              </a>
            </div>
          </div>
        );
      })() : (
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-2.5">
          <Ban className="h-3.5 w-3.5 text-slate-600 shrink-0" />
          <p className="text-sm text-slate-400">No active subscription — <span className="text-slate-300">pick a plan below to unlock all live streams.</span></p>
        </div>
      )}

      {/* ── Wallet balance strip ─────────────────────────────────────────── */}
      {user && wallet && (
        <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
          <Wallet className="h-4 w-4 text-teal-500 shrink-0" />
          <span>
            Spendable balance:{' '}
            <span className="text-white font-semibold font-mono">${Number(wallet.availableBalance).toFixed(2)}</span>
            {Number(wallet.bonusBalance) > 0 && (
              <> + <span className="text-yellow-400 font-semibold font-mono">${Number(wallet.bonusBalance).toFixed(2)} bonus</span></>
            )}
          </span>
        </div>
      )}

      {/* ── Plan cards ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(PLAN_META) as Array<keyof typeof PLAN_META>).map((key) => {
            const meta = PLAN_META[key];
            const Icon = meta.icon;
            const price = prices?.[key] ?? 0;
            const isActive = active?.hasSubscription && active.subscriptionType === key;
            const hasOtherActive = active?.hasSubscription && active.subscriptionType !== key;

            return (
              <div
                key={key}
                className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${meta.color} ${meta.border} overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/40`}
              >
                {/* Badge */}
                {meta.badge && (
                  <div className="absolute top-0 right-0">
                    <div className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl
                      ${key === 'yearly' ? 'bg-violet-500 text-white' : 'bg-amber-500 text-slate-950'}`}>
                      {meta.badge}
                    </div>
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1 gap-4">
                  {/* Icon + label */}
                  <div className="space-y-2">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10`}>
                      <Icon className={`h-5 w-5 ${meta.accent}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{meta.label}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">${price.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-slate-500">{meta.duration} access</p>
                    {meta.savings && (
                      <p className={`text-xs font-medium ${meta.accent}`}>{meta.savings}</p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5 flex-1">
                    {PLAN_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
                        <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${meta.accent}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isActive ? (
                    <div className="w-full py-2.5 rounded-xl text-center text-sm font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                      ✓ Currently Active
                    </div>
                  ) : (
                    <Button
                      onClick={() => setPendingPlan(key)}
                      disabled={mutation.isPending || hasOtherActive || !user}
                      className={`w-full font-semibold rounded-xl
                        ${key === 'yearly'
                          ? 'bg-violet-500 hover:bg-violet-400 text-white'
                          : key === 'monthly'
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : key === 'weekly'
                              ? 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                              : 'bg-slate-600 hover:bg-slate-500 text-white'
                        }`}
                    >
                      {!user ? 'Login to Subscribe' : hasOtherActive ? 'Already Subscribed' : `Get ${meta.label}`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Fine print ──────────────────────────────────────────────────── */}
      <p className="text-center text-xs text-slate-600">
        All subscriptions grant access to every live stream on the platform during the active period.
        Funds are deducted from your ATA wallet (bonus balance used first). Non-refundable.
      </p>

      {/* ── Confirmation dialog ─────────────────────────────────────────── */}
      <AlertDialog open={!!pendingPlan} onOpenChange={handleDialogClose}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border ${dialogError ? 'bg-red-500/20 border-red-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                {dialogError
                  ? <XCircle className="h-5 w-5 text-red-400" />
                  : <AlertTriangle className="h-5 w-5 text-amber-400" />
                }
              </div>
              <AlertDialogTitle className="text-white text-lg">
                {dialogError ? 'Purchase Failed' : 'Confirm Subscription'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-slate-400 text-sm">
                {/* Error state */}
                {dialogError ? (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-1.5">
                    <p className="text-red-400 font-medium">{dialogError}</p>
                    <p className="text-slate-500 text-xs">Please check your wallet balance and try again, or top up your wallet first.</p>
                  </div>
                ) : (
                  <>
                    <p>
                      You are about to purchase a{' '}
                      <span className="text-white font-semibold">
                        {pendingPlan ? PLAN_META[pendingPlan as keyof typeof PLAN_META]?.label : ''} subscription
                      </span>{' '}
                      for{' '}
                      <span className="text-white font-semibold font-mono">
                        ${pendingPlan ? (prices?.[pendingPlan] ?? 0).toFixed(2) : '0.00'}
                      </span>.
                    </p>
                    <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Plan</span>
                        <span className="text-white font-medium">
                          {pendingPlan ? PLAN_META[pendingPlan as keyof typeof PLAN_META]?.label : ''} ({pendingPlan ? PLAN_META[pendingPlan as keyof typeof PLAN_META]?.duration : ''})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount</span>
                        <span className="text-white font-mono font-medium">
                          ${pendingPlan ? (prices?.[pendingPlan] ?? 0).toFixed(2) : '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Spendable balance</span>
                        <span className="text-white font-mono font-medium">
                          ${(Number(wallet?.availableBalance ?? 0) + Number(wallet?.bonusBalance ?? 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <p className="text-amber-400/80 text-xs flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                      This amount will be deducted from your wallet immediately. Bonus balance is used first. This purchase is non-refundable.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={mutation.isPending}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              {dialogError ? 'Close' : 'Cancel'}
            </AlertDialogCancel>
            {dialogError ? (
              <Button
                onClick={() => { setPendingPlan(null); setDialogError(null); setLocation('/wallet'); }}
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Top Up Wallet
              </Button>
            ) : (
              <Button
                onClick={handleConfirm}
                disabled={mutation.isPending}
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
              >
                {mutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
                  : 'Confirm Purchase'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
