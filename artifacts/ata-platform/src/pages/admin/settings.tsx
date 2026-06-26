import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings, Radio, Save, ExternalLink, CheckCircle2, AlertCircle,
  CreditCard, Eye, EyeOff, Shield, Globe, Mail, Lock, Server, Send, Tv2,
} from 'lucide-react';
import { toast } from 'sonner';

function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });
}

export default function AdminSettings() {
  useEffect(() => { document.title = 'Settings - Admin - ATA Platform'; }, []);

  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();

  const [liveStreamUrl, setLiveStreamUrl] = useState('');
  // Mux default stream settings
  const [muxPlaybackId, setMuxPlaybackId] = useState('');
  const [muxIsLive, setMuxIsLive] = useState(false);
  const [muxIsFree, setMuxIsFree] = useState(false);
  const [muxPrice, setMuxPrice] = useState('1.50');
  const [muxTitle, setMuxTitle] = useState('');
  const [syncingMux, setSyncingMux] = useState(false);

  const [pesapalKey, setPesapalKey] = useState('');
  const [pesapalSecret, setPesapalSecret] = useState('');
  const [pesapalEnv, setPesapalEnv] = useState<'sandbox' | 'live'>('live');
  const [pesapalCurrency, setPesapalCurrency] = useState('UGX');
  const [showSecret, setShowSecret] = useState(false);

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
      setLiveStreamUrl(settings.liveStreamUrl ?? '');
      setMuxPlaybackId(settings.mux_playback_id ?? '');
      setMuxIsLive(settings.mux_is_live === 'true');
      setMuxIsFree(settings.mux_is_free === 'true');
      setMuxPrice(settings.mux_price ?? '1.50');
      setMuxTitle(settings.mux_title ?? '');
      setPesapalKey(settings.pesapal_consumer_key ?? '');
      setPesapalSecret(settings.pesapal_consumer_secret ?? '');
      setPesapalEnv((settings.pesapal_environment as 'sandbox' | 'live') ?? 'live');
      setPesapalCurrency(settings.pesapal_currency ?? 'UGX');
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

  const isValidUrl = (v: string) => {
    if (!v) return true;
    try { new URL(v); return true; } catch { return false; }
  };

  const urlOk = isValidUrl(liveStreamUrl);
  const isPesapalConfigured = !!(settings?.pesapal_consumer_key && settings?.pesapal_consumer_secret);
  const pesapalIpnId = settings?.pesapal_ipn_id;

  const saveStreamSettings = () => saveMutation.mutate({ liveStreamUrl });

  const saveMuxSettings = async () => {
    if (!muxPlaybackId.trim()) { toast.error('Mux Playback ID is required'); return; }
    const priceNum = parseFloat(muxPrice);
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Enter a valid price (0 for free)'); return; }
    await saveMutation.mutateAsync({
      mux_playback_id: muxPlaybackId.trim(),
      mux_is_live: muxIsLive ? 'true' : 'false',
      mux_is_free: muxIsFree ? 'true' : 'false',
      mux_price: priceNum.toFixed(2),
      mux_title: muxTitle.trim() || 'ATA Live Stream',
    });
    setSyncingMux(true);
    try {
      const r = await fetch('/api/settings/sync-mux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Sync failed'); }
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Mux stream settings saved and synced.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to sync Mux stream');
    } finally {
      setSyncingMux(false);
    }
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
    if (!pesapalKey.trim() || !pesapalSecret.trim()) {
      toast.error('Consumer Key and Secret are required');
      return;
    }
    saveMutation.mutate({
      pesapal_consumer_key: pesapalKey.trim(),
      pesapal_consumer_secret: pesapalSecret.trim(),
      pesapal_environment: pesapalEnv,
      pesapal_currency: pesapalCurrency.toUpperCase().trim(),
      pesapal_ipn_id: '',
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
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-teal-400" />
              Pesapal Payment Gateway
            </CardTitle>
            {isPesapalConfigured ? (
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
            API credentials from your Pesapal merchant account. Users will be charged in the selected currency.
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

      {/* ── Mux Default Stream ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Tv2 className="h-4 w-4 text-red-400" />
              Mux Default Stream
            </CardTitle>
            <div className="flex items-center gap-2">
              {muxIsLive && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> LIVE
                </Badge>
              )}
              {muxIsFree && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">FREE</Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-slate-400">
            The default Mux video feed shown on the Live page when no custom stream URL is set.
            Toggle it live to activate the paywall — mark it free to let everyone watch without paying.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Playback ID */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Mux Playback ID</Label>
            <Input
              value={muxPlaybackId}
              onChange={e => setMuxPlaybackId(e.target.value)}
              placeholder="QEQX7ir02QjD1eYSV00vdTr8waLZof6bisQLNWzom00sZ00"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">
              The ID from your Mux dashboard — e.g. <code className="text-teal-400">player.mux.com/<strong>YOUR_ID</strong></code>
            </p>
          </div>

          {/* Stream title (shown in paywall) */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Stream Title</Label>
            <Input
              value={muxTitle}
              onChange={e => setMuxTitle(e.target.value)}
              placeholder="ATA Live Stream"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">Shown in the paywall overlay and stream info bar.</p>
          </div>

          {/* Access price */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Access Price (USD)</Label>
            <div className="flex items-center gap-2 w-36">
              <span className="text-slate-400 text-sm">$</span>
              <Input
                type="number"
                min="0"
                step="0.50"
                value={muxPrice}
                onChange={e => setMuxPrice(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                disabled={isLoading || muxIsFree}
              />
            </div>
            <p className="text-xs text-slate-500">Charged from the user's wallet for 24-hour access.</p>
          </div>

          {/* Live toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMuxIsLive(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${muxIsLive ? 'bg-red-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${muxIsLive ? 'translate-x-5' : ''}`} />
              </button>
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setMuxIsLive(v => !v)}>
                Stream is <strong className={muxIsLive ? 'text-red-400' : 'text-slate-400'}>{muxIsLive ? 'LIVE' : 'offline'}</strong>
                {muxIsLive ? ' — paywall is active' : ' — no paywall'}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMuxIsFree(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${muxIsFree ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${muxIsFree ? 'translate-x-5' : ''}`} />
              </button>
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setMuxIsFree(v => !v)}>
                Free stream — <span className={muxIsFree ? 'text-emerald-400' : 'text-slate-400'}>
                  {muxIsFree ? 'anyone can watch without paying' : 'paywall applies when live'}
                </span>
              </Label>
            </div>
          </div>

          {muxIsLive && !muxIsFree && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Paywall is <strong>ON</strong>. Users must pay ${muxPrice || '1.50'} from their wallet for 24-hour access. Toggle "Free stream" to let everyone watch for free.</span>
            </div>
          )}

          <div className="pt-1">
            <Button
              onClick={saveMuxSettings}
              disabled={saveMutation.isPending || syncingMux || isLoading}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending || syncingMux ? 'Saving…' : 'Save Mux Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Live Broadcast URL ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400" />
            Live Broadcast URL
          </CardTitle>
          <CardDescription className="text-slate-400">
            The single embed URL shown to all viewers on the <strong className="text-slate-200">/live</strong> page.
            Supports HLS (<code className="text-teal-400">.m3u8</code>), RTMP-over-HLS, or any direct video URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="liveStreamUrl" className="text-slate-300 text-sm">Stream URL</Label>
            <div className="relative">
              <Input
                id="liveStreamUrl"
                value={liveStreamUrl}
                onChange={(e) => setLiveStreamUrl(e.target.value)}
                placeholder="https://example.com/stream/playlist.m3u8"
                className={`bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 pr-9
                  ${!urlOk ? 'border-red-500/60 focus-visible:ring-red-500/40' : ''}`}
                disabled={isLoading}
              />
              {liveStreamUrl && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {urlOk
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <AlertCircle className="h-4 w-4 text-red-400" />
                  }
                </span>
              )}
            </div>
            {!urlOk && <p className="text-red-400 text-xs">Enter a valid URL (must start with http:// or https://)</p>}
            {liveStreamUrl && urlOk && (
              <a
                href={liveStreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Open URL in new tab
              </a>
            )}
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Button
              onClick={saveStreamSettings}
              disabled={saveMutation.isPending || !urlOk || isLoading}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </Button>
            {liveStreamUrl !== (settings?.liveStreamUrl ?? '') && (
              <span className="text-amber-400 text-xs">Unsaved changes</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
