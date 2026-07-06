import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings, Save, ExternalLink, CheckCircle2, AlertCircle,
  CreditCard, Eye, EyeOff, Shield, Globe, Mail, Lock, Server, Send, Zap, Power,
  Database, Download, Upload, AlertTriangle, Users, Star,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });
}

export default function AdminSettings() {
  useEffect(() => { document.title = 'Settings - Admin - ATA Platform'; }, []);

  const { isAdmin } = useAuth();
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();

  // Subscription prices
  const [priceDaily,   setPriceDaily]   = useState('1.70');
  const [priceWeekly,  setPriceWeekly]  = useState('7.00');
  const [priceMonthly, setPriceMonthly] = useState('20.00');
  const [priceYearly,  setPriceYearly]  = useState('99.00');

  const [referralBonusPct, setReferralBonusPct] = useState('10');
  const [influencerCommissionRate, setInfluencerCommissionRate] = useState('30');

  const [pesapalKey, setPesapalKey] = useState('');
  const [pesapalSecret, setPesapalSecret] = useState('');
  const [pesapalEnv, setPesapalEnv] = useState<'sandbox' | 'live'>('live');
  const [pesapalCurrency, setPesapalCurrency] = useState('UGX');
  const [showSecret, setShowSecret] = useState(false);

  // Gateway enable/disable toggles
  const [pesapalEnabled, setPesapalEnabled] = useState(true);
  const [pawapayEnabled, setPawapayEnabled] = useState(true);

  // Database export / restore
  const [exportingDb, setExportingDb] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoringDb, setRestoringDb] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const downloadDbBackup = async () => {
    setExportingDb(true);
    try {
      const token = (await import('@/lib/auth-store')).useAuthStore.getState().token;
      const res = await fetch('/api/admin/db-export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `ata-backup-${ts}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Database exported', { description: `ata-backup-${ts}.sql downloaded.` });
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExportingDb(false);
    }
  };

  const performRestore = async () => {
    if (!restoreFile) return;
    setRestoringDb(true);
    setRestoreConfirmOpen(false);
    try {
      const token = (await import('@/lib/auth-store')).useAuthStore.getState().token;
      const form = new FormData();
      form.append('backup', restoreFile);
      const res = await fetch('/api/admin/db-restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Restore failed');
      toast.success('Database restored', { description: 'All data has been replaced from the uploaded backup.' });
      setRestoreFile(null);
    } catch (err: any) {
      toast.error(err.message || 'Restore failed');
    } finally {
      setRestoringDb(false);
    }
  };

  // PawaPay
  const [pawapayToken, setPawapayToken] = useState('');
  const [pawapayEnv, setPawapayEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [pawapayCurrency, setPaywapayCurrency] = useState('UGX');
  const [pawapayRate, setPawapayRate] = useState('3700');
  const [showPawapayToken, setShowPawapayToken] = useState(false);

  // SMTP
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    if (settings) {
      setPriceDaily(settings.price_daily     ?? '1.70');
      setPriceWeekly(settings.price_weekly   ?? '7.00');
      setPriceMonthly(settings.price_monthly ?? '20.00');
      setPriceYearly(settings.price_yearly   ?? '99.00');
      setReferralBonusPct(settings.referral_bonus_pct ?? '10');
      setInfluencerCommissionRate(settings.influencer_commission_rate ?? '30');
      setPesapalKey(settings.pesapal_consumer_key ?? '');
      setPesapalSecret(settings.pesapal_consumer_secret ?? '');
      setPesapalEnv((settings.pesapal_environment as 'sandbox' | 'live') ?? 'live');
      setPesapalCurrency(settings.pesapal_currency ?? 'UGX');
      setPesapalEnabled(settings.pesapal_enabled !== 'false');
      setPawapayToken(settings.pawapay_api_token ?? '');
      setPawapayEnv((settings.pawapay_environment as 'sandbox' | 'production') ?? 'sandbox');
      setPaywapayCurrency(settings.pawapay_currency ?? 'UGX');
      setPawapayRate(settings.pawapay_exchange_rate ?? '3700');
      setPawapayEnabled(settings.pawapay_enabled !== 'false');
      setSmtpHost(settings.smtp_host ?? '');
      setSmtpPort(settings.smtp_port ?? '587');
      setSmtpUser(settings.smtp_user ?? '');
      setSmtpPass(settings.smtp_pass ?? '');
      setSmtpFrom(settings.smtp_from ?? '');
      setSmtpSecure(settings.smtp_secure === 'true');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Save failed'); }
      return r.json();
    },
    onSuccess: () => {
      toast.success('Settings saved.');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save settings'),
  });

  const isPesapalConfigured = !!(settings?.pesapal_consumer_key && settings?.pesapal_consumer_secret);
  const pesapalIpnId = settings?.pesapal_ipn_id;

  const saveSubscriptionPrices = () => {
    const prices = [
      { key: 'price_daily',   val: priceDaily,   label: 'Daily' },
      { key: 'price_weekly',  val: priceWeekly,  label: 'Weekly' },
      { key: 'price_monthly', val: priceMonthly, label: 'Monthly' },
      { key: 'price_yearly',  val: priceYearly,  label: 'Yearly' },
    ];
    for (const { val, label } of prices) {
      const n = parseFloat(val);
      if (isNaN(n) || n < 0) { toast.error(`${label} price must be a valid positive number`); return; }
    }
    const updates: Record<string, string> = {};
    for (const { key, val } of prices) updates[key] = parseFloat(val).toFixed(2);
    saveMutation.mutate(updates);
  };

  const saveSmtpSettings = () => {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      toast.error('Host, Username and Password are required');
      return;
    }
    saveMutation.mutate({
      smtp_host: smtpHost.trim(),
      smtp_port: smtpPort.trim() || '587',
      smtp_user: smtpUser.trim(),
      smtp_pass: smtpPass.trim(),
      smtp_from: smtpFrom.trim(),
      smtp_secure: smtpSecure ? 'true' : 'false',
    });
  };

  const sendTestEmail = async () => {
    setTestingSmtp(true);
    try {
      const r = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) toast.success('Test email sent — check your inbox.');
      else toast.error(d.error || 'Failed to send test email');
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setTestingSmtp(false);
    }
  };

  const savePesapalSettings = () => {
    if (pesapalEnabled && (!pesapalKey.trim() || !pesapalSecret.trim())) {
      toast.error('Consumer Key and Secret are required when Pesapal is enabled');
      return;
    }
    saveMutation.mutate({
      pesapal_enabled: pesapalEnabled ? 'true' : 'false',
      pesapal_consumer_key: pesapalKey.trim(),
      pesapal_consumer_secret: pesapalSecret.trim(),
      pesapal_environment: pesapalEnv,
      pesapal_currency: pesapalCurrency.toUpperCase().trim(),
      pesapal_ipn_id: '',
    });
  };

  const savePawapaySettings = () => {
    if (pawapayEnabled && !pawapayToken.trim()) { toast.error('API Token is required when PawaPay is enabled'); return; }
    const rate = parseFloat(pawapayRate);
    if (isNaN(rate) || rate <= 0) { toast.error('Exchange rate must be a positive number'); return; }
    saveMutation.mutate({
      pawapay_enabled: pawapayEnabled ? 'true' : 'false',
      pawapay_api_token: pawapayToken.trim(),
      pawapay_environment: pawapayEnv,
      pawapay_currency: pawapayCurrency.toUpperCase().trim() || 'UGX',
      pawapay_exchange_rate: rate.toString(),
    });
  };

  const isSmtpConfigured = !!(settings?.smtp_host && settings?.smtp_user && settings?.smtp_pass);
  const smtpDirty = smtpHost !== (settings?.smtp_host ?? '') ||
    smtpPort !== (settings?.smtp_port ?? '587') ||
    smtpUser !== (settings?.smtp_user ?? '') ||
    smtpPass !== (settings?.smtp_pass ?? '') ||
    smtpFrom !== (settings?.smtp_from ?? '') ||
    smtpSecure !== (settings?.smtp_secure === 'true');

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Global platform configuration</p>
        </div>
      </div>

      {/* ── Subscription Pricing ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-400" /> Subscription Pricing
          </CardTitle>
          <CardDescription className="text-slate-400">
            Set global access prices for all subscription tiers. Changes apply immediately to all new purchases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Daily',   desc: '24-hour access', val: priceDaily,   set: setPriceDaily   },
              { label: 'Weekly',  desc: '7-day access',   val: priceWeekly,  set: setPriceWeekly  },
              { label: 'Monthly', desc: '30-day access',  val: priceMonthly, set: setPriceMonthly },
              { label: 'Yearly',  desc: '365-day access', val: priceYearly,  set: setPriceYearly  },
            ].map(({ label, desc, val, set }) => (
              <div key={label} className="space-y-1.5">
                <Label className="text-slate-300 text-sm">{label} <span className="text-slate-500 font-normal text-xs">({desc})</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={val}
                    onChange={e => set(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white font-mono text-sm pl-7"
                    disabled={isLoading}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={saveSubscriptionPrices}
            disabled={saveMutation.isPending || isLoading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Prices'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Influencer Commission ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" /> Influencer Commission
          </CardTitle>
          <CardDescription className="text-slate-400">
            When a referred user purchases any subscription, the influencer who referred them receives this percentage of the subscription price directly into their main (withdrawable) wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 w-40">
              <Label className="text-slate-300 text-sm">Commission Percentage</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={influencerCommissionRate}
                  onChange={e => setInfluencerCommissionRate(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white font-mono text-sm pr-8"
                  disabled={isLoading}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
              </div>
            </div>
            <Button
              onClick={() => {
                const v = parseFloat(influencerCommissionRate);
                if (isNaN(v) || v < 0 || v > 100) { toast.error('Enter a value between 0 and 100'); return; }
                saveMutation.mutate({ influencer_commission_rate: v.toString() });
              }}
              disabled={saveMutation.isPending || isLoading}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Current rate: <span className="text-amber-400 font-mono font-semibold">{settings?.influencer_commission_rate ?? '30'}%</span> of the subscription price, credited as real cash (not bonus).
            Set to <span className="font-mono">0</span> to pause influencer payouts. Manage influencers under the <span className="text-amber-400">Influencers</span> menu.
          </p>
        </CardContent>
      </Card>

      {/* ── Referral Program ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-400" /> Referral Program
          </CardTitle>
          <CardDescription className="text-slate-400">
            When a referred user purchases their first livestream, the referrer earns this percentage of the stream price as a bonus credit (valid 90 days).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 w-40">
              <Label className="text-slate-300 text-sm">Bonus Percentage</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={referralBonusPct}
                  onChange={e => setReferralBonusPct(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white font-mono text-sm pr-8"
                  disabled={isLoading}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
              </div>
            </div>
            <Button
              onClick={() => {
                const v = parseFloat(referralBonusPct);
                if (isNaN(v) || v < 0 || v > 100) { toast.error('Enter a value between 0 and 100'); return; }
                saveMutation.mutate({ referral_bonus_pct: v.toString() });
              }}
              disabled={saveMutation.isPending || isLoading}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Current rate: <span className="text-teal-400 font-mono font-semibold">{settings?.referral_bonus_pct ?? '10'}%</span> of the stream access price.
            Set to <span className="font-mono">0</span> to disable referral bonuses entirely.
          </p>
        </CardContent>
      </Card>

      {isAdmin && (<>
      {/* ── Email / SMTP ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-teal-400" /> Email Notifications (SMTP)
            </CardTitle>
            {isSmtpConfigured ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Configured
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                <AlertCircle className="h-3 w-3" /> Not set
              </Badge>
            )}
          </div>
          <CardDescription className="text-slate-400">
            SMTP credentials for sending email notifications to users and the finance team.
            Emails are sent for: withdrawal approved/paid/rejected, bet matched, bet won/lost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-300 text-sm flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" /> SMTP Host
              </Label>
              <Input
                value={smtpHost}
                onChange={e => setSmtpHost(e.target.value)}
                placeholder="mail.example.com"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Port</Label>
              <Input
                value={smtpPort}
                onChange={e => setSmtpPort(e.target.value)}
                placeholder="587"
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* User */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Username / Email
            </Label>
            <Input
              value={smtpUser}
              onChange={e => setSmtpUser(e.target.value)}
              placeholder="noreply@atasportslive.com"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm"
              disabled={isLoading}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Password / App Password
            </Label>
            <div className="relative">
              <Input
                type={showSmtpPass ? 'text' : 'password'}
                value={smtpPass}
                onChange={e => setSmtpPass(e.target.value)}
                placeholder="••••••••••••"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowSmtpPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* From address */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">From Address (optional)</Label>
            <Input
              value={smtpFrom}
              onChange={e => setSmtpFrom(e.target.value)}
              placeholder='ATA Sports Live <noreply@atasportslive.com>'
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">Leave blank to use the username as the From address.</p>
          </div>

          {/* SSL toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSmtpSecure(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${smtpSecure ? 'bg-teal-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${smtpSecure ? 'translate-x-5' : ''}`} />
            </button>
            <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setSmtpSecure(v => !v)}>
              Use SSL/TLS (port 465) — disable for STARTTLS (port 587)
            </Label>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <Button
              onClick={saveSmtpSettings}
              disabled={saveMutation.isPending || isLoading}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save Email Settings'}
            </Button>
            {isSmtpConfigured && !smtpDirty && (
              <Button
                variant="outline"
                onClick={sendTestEmail}
                disabled={testingSmtp}
                className="border-slate-700 text-slate-300 hover:text-white gap-2"
              >
                <Send className="h-4 w-4" />
                {testingSmtp ? 'Sending…' : 'Send Test Email'}
              </Button>
            )}
            {smtpDirty && <span className="text-amber-400 text-xs">Unsaved changes — save before testing</span>}
          </div>

          <div className="rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2.5 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400">When emails are sent</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>User: withdrawal approved, paid, or rejected</li>
              <li>Finance team: every time admin approves a withdrawal (payment queue alert)</li>
              <li>User: bet matched with opponent</li>
              <li>User: bet won (with payout amount) or lost</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── Pesapal Payment Gateway ── */}
      <Card className={`border-slate-700 transition-colors ${pesapalEnabled ? 'bg-slate-900' : 'bg-slate-900/50 border-slate-700/60'}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className={`h-4 w-4 ${pesapalEnabled ? 'text-teal-400' : 'text-slate-500'}`} />
              Pesapal Payment Gateway
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              {/* Active / Disabled badge */}
              {pesapalEnabled ? (
                isPesapalConfigured ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                    <AlertCircle className="h-3 w-3" /> Not configured
                  </Badge>
                )
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                  <Power className="h-3 w-3" /> Disabled
                </Badge>
              )}
              {/* Enable / Disable toggle */}
              <button
                type="button"
                onClick={() => setPesapalEnabled(v => !v)}
                title={pesapalEnabled ? 'Disable Pesapal' : 'Enable Pesapal'}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${pesapalEnabled ? 'bg-teal-500 focus:ring-teal-500' : 'bg-slate-600 focus:ring-slate-500'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${pesapalEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
          <CardDescription className="text-slate-400">
            API credentials from your Pesapal merchant account. Users will be charged in the selected currency.
            {!pesapalEnabled && (
              <span className="block mt-1.5 text-red-400/80 font-medium">
                ⚠ Pesapal is disabled — users cannot make Pesapal deposits until re-enabled.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Environment toggle */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Environment
            </Label>
            <div className="flex gap-2">
              {(['live', 'sandbox'] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => setPesapalEnv(env)}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                    pesapalEnv === env
                      ? env === 'live'
                        ? 'bg-teal-500 border-teal-500 text-slate-950'
                        : 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {env === 'live' ? '🟢 Live (Production)' : '🧪 Sandbox (Testing)'}
                </button>
              ))}
            </div>
            {pesapalEnv === 'sandbox' && (
              <p className="text-xs text-amber-400/80 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Sandbox mode — payments are simulated, no real charges.
              </p>
            )}
          </div>

          {/* Consumer Key */}
          <div className="space-y-1.5">
            <Label htmlFor="pesapalKey" className="text-slate-300 text-sm flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Consumer Key
            </Label>
            <Input
              id="pesapalKey"
              value={pesapalKey}
              onChange={(e) => setPesapalKey(e.target.value)}
              placeholder="Your Pesapal consumer_key"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm"
              disabled={isLoading}
            />
          </div>

          {/* Consumer Secret */}
          <div className="space-y-1.5">
            <Label htmlFor="pesapalSecret" className="text-slate-300 text-sm flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Consumer Secret
            </Label>
            <div className="relative">
              <Input
                id="pesapalSecret"
                type={showSecret ? 'text' : 'password'}
                value={pesapalSecret}
                onChange={(e) => setPesapalSecret(e.target.value)}
                placeholder="Your Pesapal consumer_secret"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label htmlFor="pesapalCurrency" className="text-slate-300 text-sm">Charge Currency</Label>
            <Input
              id="pesapalCurrency"
              value={pesapalCurrency}
              onChange={(e) => setPesapalCurrency(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="UGX"
              maxLength={3}
              className="bg-slate-800 border-slate-700 text-white font-mono w-28"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">ISO 4217 currency code. Default: UGX (Ugandan Shilling)</p>
          </div>

          {/* IPN status */}
          {pesapalIpnId && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              IPN registered — ID: <span className="font-mono">{pesapalIpnId.slice(0, 16)}…</span>
            </div>
          )}

          <div className="pt-1 flex items-center gap-3">
            <Button
              onClick={savePesapalSettings}
              disabled={saveMutation.isPending || isLoading}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save Pesapal Settings'}
            </Button>
            <a
              href="https://pay.pesapal.com/iframe/PesapalIframe3/Index"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Pesapal Merchant Portal
            </a>
          </div>

          <div className="rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2.5 text-xs text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-400">How it works</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Users choose Pesapal on the deposit page and enter an amount in {pesapalCurrency || 'UGX'}.</li>
              <li>They're redirected to Pesapal to pay via MoMo, Airtel Money, card, or USSD.</li>
              <li>On payment, Pesapal sends an IPN notification and redirects back — wallet is credited automatically.</li>
              <li>Changing credentials clears the saved IPN ID so it re-registers on next payment.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── PawaPay ── */}
      <Card className={`border-slate-700 transition-colors ${pawapayEnabled ? 'bg-slate-900' : 'bg-slate-900/50 border-slate-700/60'}`}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className={`h-4 w-4 ${pawapayEnabled ? 'text-green-400' : 'text-slate-500'}`} />
              PawaPay
            </CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              {/* Active / Disabled badge */}
              {pawapayEnabled ? (
                settings?.pawapay_api_token ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge className="bg-slate-700 text-slate-400 border-slate-600">Not configured</Badge>
                )
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
                  <Power className="h-3 w-3" /> Disabled
                </Badge>
              )}
              {/* Enable / Disable toggle */}
              <button
                type="button"
                onClick={() => setPawapayEnabled(v => !v)}
                title={pawapayEnabled ? 'Disable PawaPay' : 'Enable PawaPay'}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${pawapayEnabled ? 'bg-green-500 focus:ring-green-500' : 'bg-slate-600 focus:ring-slate-500'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${pawapayEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
          <CardDescription className="text-slate-400">
            Preferred mobile money gateway for Uganda and East Africa. Enables instant deposits and withdrawals via MTN MoMo, Airtel Money, M-Pesa, and more — no admin approval needed for mobile money withdrawals when configured.
            {!pawapayEnabled && (
              <span className="block mt-1.5 text-red-400/80 font-medium">
                ⚠ PawaPay is disabled — instant deposits and payouts are suspended until re-enabled. Withdrawals will fall back to manual processing.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Environment */}
          <div className="space-y-2">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Environment
            </Label>
            <div className="flex gap-2">
              {(['production', 'sandbox'] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => setPawapayEnv(env)}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                    pawapayEnv === env
                      ? env === 'production'
                        ? 'bg-green-500 border-green-500 text-slate-950'
                        : 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {env === 'production' ? '🟢 Production' : '🧪 Sandbox (Testing)'}
                </button>
              ))}
            </div>
            {pawapayEnv === 'sandbox' && (
              <p className="text-xs text-amber-400/80 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Sandbox mode — transactions are simulated.
              </p>
            )}
          </div>

          {/* API Token */}
          <div className="space-y-1.5">
            <Label htmlFor="pawapayToken" className="text-slate-300 text-sm flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> API Token
            </Label>
            <div className="relative">
              <Input
                id="pawapayToken"
                type={showPawapayToken ? 'text' : 'password'}
                value={pawapayToken}
                onChange={(e) => setPawapayToken(e.target.value)}
                placeholder="Your PawaPay Bearer token"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPawapayToken(!showPawapayToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPawapayToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">Found in your PawaPay dashboard under API Access.</p>
          </div>

          {/* Currency & Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pawapayCurrency" className="text-slate-300 text-sm">Local Currency</Label>
              <Input
                id="pawapayCurrency"
                value={pawapayCurrency}
                onChange={(e) => setPaywapayCurrency(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="UGX"
                maxLength={3}
                className="bg-slate-800 border-slate-700 text-white font-mono"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">ISO 4217 code (default UGX)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pawapayRate" className="text-slate-300 text-sm">USD Exchange Rate</Label>
              <Input
                id="pawapayRate"
                type="number"
                min="1"
                step="1"
                value={pawapayRate}
                onChange={(e) => setPawapayRate(e.target.value)}
                placeholder="3700"
                className="bg-slate-800 border-slate-700 text-white font-mono"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">Units of local currency per $1 USD</p>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-3">
            <Button
              onClick={savePawapaySettings}
              disabled={saveMutation.isPending || isLoading}
              className="bg-green-500 hover:bg-green-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save PawaPay Settings'}
            </Button>
            <a
              href="https://dashboard.pawapay.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> PawaPay Dashboard
            </a>
          </div>

          <div className="rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2.5 text-xs text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-400">How it works</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Users select PawaPay on the Wallet deposit page, enter their mobile number &amp; network.</li>
              <li>A mobile money prompt is pushed directly to their phone — no redirect needed.</li>
              <li>On approval, PawaPay sends a callback and the wallet is credited instantly.</li>
              <li>Withdrawals for MTN MoMo and Airtel Money users are processed automatically — no admin approval queue.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
      </>)}


      {isAdmin && (
      <Card className="bg-slate-900 border-slate-700">
        {/* ── Database Backup & Restore (admin only) ── */}
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-teal-400" />
            Database Backup &amp; Restore
          </CardTitle>
          <CardDescription className="text-slate-400">
            Export a full SQL dump of the live database, or upload a backup file to restore all data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── Export ── */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300">Export</p>
            <p className="text-xs text-slate-500">
              Downloads a complete SQL dump — includes all users, wallets, bets, transactions, streams, and settings.
            </p>
            <Button
              onClick={downloadDbBackup}
              disabled={exportingDb}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Download className="h-4 w-4" />
              {exportingDb ? 'Exporting…' : 'Download Backup (.sql)'}
            </Button>
          </div>

          <div className="border-t border-slate-700" />

          {/* ── Restore ── */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-300">Restore</p>
            <div className="rounded-md bg-amber-950/40 border border-amber-700/50 px-3 py-2.5 flex gap-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Restoring will <strong>permanently delete all current data</strong> and replace it with the contents of the uploaded file. This cannot be undone.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".sql"
                  className="hidden"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-600 bg-slate-800 cursor-pointer hover:border-teal-500 transition-colors text-sm text-slate-400 hover:text-slate-200">
                  <Upload className="h-4 w-4 shrink-0" />
                  {restoreFile ? (
                    <span className="text-teal-400 truncate max-w-[220px]">{restoreFile.name}</span>
                  ) : (
                    <span>Choose a .sql backup file…</span>
                  )}
                </div>
              </label>

              <Button
                onClick={() => setRestoreConfirmOpen(true)}
                disabled={!restoreFile || restoringDb}
                variant="destructive"
                className="gap-2 font-bold shrink-0"
              >
                <Upload className="h-4 w-4" />
                {restoringDb ? 'Restoring…' : 'Restore Database'}
              </Button>
            </div>
            {restoreFile && (
              <p className="text-[11px] text-slate-500">
                {(restoreFile.size / 1024 / 1024).toFixed(2)} MB selected
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Restore confirmation dialog */}
      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Restore Database?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will <strong className="text-white">drop every table</strong> in the current database and replace all data with{' '}
              <span className="text-teal-400 font-medium">{restoreFile?.name}</span>.
              <br /><br />
              All users, wallets, bets, and transactions will be overwritten. <strong className="text-white">This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={performRestore}
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
            >
              Yes, restore now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
