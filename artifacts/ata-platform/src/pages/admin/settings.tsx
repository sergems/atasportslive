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
  CreditCard, Eye, EyeOff, Shield, Globe
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
  const [pesapalKey, setPesapalKey] = useState('');
  const [pesapalSecret, setPesapalSecret] = useState('');
  const [pesapalEnv, setPesapalEnv] = useState<'sandbox' | 'live'>('live');
  const [pesapalCurrency, setPesapalCurrency] = useState('UGX');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (settings) {
      setLiveStreamUrl(settings.liveStreamUrl ?? '');
      setPesapalKey(settings.pesapal_consumer_key ?? '');
      setPesapalSecret(settings.pesapal_consumer_secret ?? '');
      setPesapalEnv((settings.pesapal_environment as 'sandbox' | 'live') ?? 'live');
      setPesapalCurrency(settings.pesapal_currency ?? 'UGX');
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

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Global platform configuration</p>
        </div>
      </div>

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
