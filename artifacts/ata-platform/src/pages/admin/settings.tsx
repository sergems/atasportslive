import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Radio, Save, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
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

  useEffect(() => {
    if (settings) setLiveStreamUrl(settings.liveStreamUrl ?? '');
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

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Global platform configuration</p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400" />
            Live Broadcast URL
          </CardTitle>
          <CardDescription className="text-slate-400">
            The single embed URL shown to all viewers on the <strong className="text-slate-200">/live</strong> page. 
            Set it once — all stream cards link here. Supports HLS (<code className="text-teal-400">.m3u8</code>), 
            RTMP-over-HLS, or any direct video URL.
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
            {!urlOk && (
              <p className="text-red-400 text-xs">Enter a valid URL (must start with http:// or https://)</p>
            )}
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
              onClick={() => saveMutation.mutate({ liveStreamUrl })}
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

      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-5 space-y-2 text-xs text-slate-500">
          <p className="font-semibold text-slate-400 text-sm">How it works</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>This URL is the single source of truth for what plays on the <strong className="text-slate-400">/live</strong> page.</li>
            <li>Users still need to purchase access ($1.50) to watch — the paywall remains active.</li>
            <li>Leave the URL blank to show the "No live broadcast" screen to all visitors.</li>
            <li>Update it anytime a new broadcast goes live — no need to touch individual streams.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
