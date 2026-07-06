import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Radio, Save, AlertCircle, Tv2, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';

function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });
}

function Toggle({ value, onChange, activeColor = 'bg-red-500' }: { value: boolean; onChange: (v: boolean) => void; activeColor?: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? activeColor : 'bg-slate-700'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  );
}

const extractYouTubeId = (input: string): string => {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = input.match(p); if (m) return m[1]; }
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  return input;
};

const isValidYtId = (id: string) => /^[a-zA-Z0-9_-]{11}$/.test(id);

// ─── Per-channel form ──────────────────────────────────────────────────────────

function ChannelForm({ channel, settings, token, qc, isLoading, saveMutation }: {
  channel: 1 | 2 | 3;
  settings: Record<string, string>;
  token: string | null;
  qc: ReturnType<typeof useQueryClient>;
  isLoading: boolean;
  saveMutation: ReturnType<typeof useMutation<any, any, Record<string, string>>>;
}) {
  const prefix = channel === 1 ? '' : `ch${channel}_`;
  const muxSyncPath = channel === 1 ? '/api/settings/sync-mux' : `/api/settings/sync-ch${channel}-mux`;
  const ytSyncPath  = channel === 1 ? '/api/settings/sync-yt'  : `/api/settings/sync-ch${channel}-yt`;
  const chLabel = channel === 1 ? 'Channel 1 — Main Live Page (/live)' : `Channel ${channel} — /live-${channel}`;

  // Page enabled (ch2/ch3 only)
  const [pageEnabled, setPageEnabled] = useState(channel === 1 ? true : false);

  // Mux
  const [muxPlaybackId, setMuxPlaybackId] = useState('');
  const [muxIsLive, setMuxIsLive] = useState(false);
  const [muxIsFree, setMuxIsFree] = useState(false);
  const [muxPrice, setMuxPrice] = useState('1.50');
  const [muxTitle, setMuxTitle] = useState('');
  const [muxThumbnailUrl, setMuxThumbnailUrl] = useState('');
  const [muxPlayerA, setMuxPlayerA] = useState('');
  const [muxPlayerB, setMuxPlayerB] = useState('');
  const [muxPlayerACountry, setMuxPlayerACountry] = useState('');
  const [muxPlayerBCountry, setMuxPlayerBCountry] = useState('');
  const [syncingMux, setSyncingMux] = useState(false);
  const muxThumbInputRef = React.useRef<HTMLInputElement>(null);

  // YouTube
  const [ytVideoId, setYtVideoId] = useState('');
  const [ytIsLive, setYtIsLive] = useState(false);
  const [ytIsFree, setYtIsFree] = useState(false);
  const [ytPrice, setYtPrice] = useState('1.50');
  const [ytTitle, setYtTitle] = useState('');
  const [ytThumbnailUrl, setYtThumbnailUrl] = useState('');
  const [ytPlayerA, setYtPlayerA] = useState('');
  const [ytPlayerB, setYtPlayerB] = useState('');
  const [ytPlayerACountry, setYtPlayerACountry] = useState('');
  const [ytPlayerBCountry, setYtPlayerBCountry] = useState('');
  const [syncingYt, setSyncingYt] = useState(false);
  const ytThumbInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!settings) return;
    if (channel !== 1) setPageEnabled(settings[`ch${channel}_page_enabled`] === 'true');
    setMuxPlaybackId(settings[`${prefix}mux_playback_id`] ?? '');
    setMuxIsLive(settings[`${prefix}mux_is_live`] === 'true');
    setMuxIsFree(settings[`${prefix}mux_is_free`] === 'true');
    setMuxPrice(settings[`${prefix}mux_price`] ?? '1.50');
    setMuxTitle(settings[`${prefix}mux_title`] ?? '');
    setMuxThumbnailUrl(settings[`${prefix}mux_thumbnail_url`] ?? '');
    setMuxPlayerA(settings[`${prefix}mux_player_a`] ?? '');
    setMuxPlayerB(settings[`${prefix}mux_player_b`] ?? '');
    setMuxPlayerACountry(settings[`${prefix}mux_player_a_country`] ?? '');
    setMuxPlayerBCountry(settings[`${prefix}mux_player_b_country`] ?? '');
    setYtVideoId(settings[`${prefix}yt_video_id`] ?? '');
    setYtIsLive(settings[`${prefix}yt_is_live`] === 'true');
    setYtIsFree(settings[`${prefix}yt_is_free`] === 'true');
    setYtPrice(settings[`${prefix}yt_price`] ?? '1.50');
    setYtTitle(settings[`${prefix}yt_title`] ?? '');
    setYtThumbnailUrl(settings[`${prefix}yt_thumbnail_url`] ?? '');
    setYtPlayerA(settings[`${prefix}yt_player_a`] ?? '');
    setYtPlayerB(settings[`${prefix}yt_player_b`] ?? '');
    setYtPlayerACountry(settings[`${prefix}yt_player_a_country`] ?? '');
    setYtPlayerBCountry(settings[`${prefix}yt_player_b_country`] ?? '');
  }, [settings, channel, prefix]);

  const saveMuxSettings = async () => {
    if (!muxPlaybackId.trim()) { toast.error('Mux Playback ID is required'); return; }
    const priceNum = parseFloat(muxPrice);
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Enter a valid price (0 for free)'); return; }
    const updates: Record<string, string> = {
      [`${prefix}mux_playback_id`]:  muxPlaybackId.trim(),
      [`${prefix}mux_is_live`]:      muxIsLive ? 'true' : 'false',
      [`${prefix}mux_is_free`]:      muxIsFree ? 'true' : 'false',
      [`${prefix}mux_price`]:        priceNum.toFixed(2),
      [`${prefix}mux_title`]:        muxTitle.trim() || `ATA Live Stream${channel > 1 ? ` ${channel}` : ''}`,
      [`${prefix}mux_thumbnail_url`]: muxThumbnailUrl.trim(),
      [`${prefix}mux_player_a`]:     muxPlayerA.trim(),
      [`${prefix}mux_player_b`]:     muxPlayerB.trim(),
      [`${prefix}mux_player_a_country`]: muxPlayerACountry.trim().toUpperCase().slice(0, 2),
      [`${prefix}mux_player_b_country`]: muxPlayerBCountry.trim().toUpperCase().slice(0, 2),
    };
    if (channel !== 1) updates[`ch${channel}_page_enabled`] = pageEnabled ? 'true' : 'false';
    await saveMutation.mutateAsync(updates);
    setSyncingMux(true);
    try {
      const r = await fetch(muxSyncPath, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Sync failed'); }
      if (muxIsLive) setYtIsLive(false);
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Mux stream settings saved and synced.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to sync Mux stream');
    } finally {
      setSyncingMux(false);
    }
  };

  const saveYtSettings = async () => {
    const videoId = extractYouTubeId(ytVideoId.trim());
    if (!videoId) { toast.error('YouTube Video ID or URL is required'); return; }
    if (!isValidYtId(videoId)) { toast.error('Could not extract a valid YouTube video ID — paste the full URL or the 11-character ID'); return; }
    const priceNum = parseFloat(ytPrice);
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Enter a valid price (0 for free)'); return; }
    const updates: Record<string, string> = {
      [`${prefix}yt_video_id`]:      videoId,
      [`${prefix}yt_is_live`]:       ytIsLive ? 'true' : 'false',
      [`${prefix}yt_is_free`]:       ytIsFree ? 'true' : 'false',
      [`${prefix}yt_price`]:         priceNum.toFixed(2),
      [`${prefix}yt_title`]:         ytTitle.trim() || `ATA Live Stream${channel > 1 ? ` ${channel}` : ''}`,
      [`${prefix}yt_thumbnail_url`]: ytThumbnailUrl.trim(),
      [`${prefix}yt_player_a`]:      ytPlayerA.trim(),
      [`${prefix}yt_player_b`]:      ytPlayerB.trim(),
      [`${prefix}yt_player_a_country`]: ytPlayerACountry.trim().toUpperCase().slice(0, 2),
      [`${prefix}yt_player_b_country`]: ytPlayerBCountry.trim().toUpperCase().slice(0, 2),
    };
    if (channel !== 1) updates[`ch${channel}_page_enabled`] = pageEnabled ? 'true' : 'false';
    await saveMutation.mutateAsync(updates);
    setSyncingYt(true);
    try {
      const r = await fetch(ytSyncPath, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Sync failed'); }
      if (ytIsLive) setMuxIsLive(false);
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('YouTube stream settings saved and synced.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to sync YouTube stream');
    } finally {
      setSyncingYt(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3 text-sm text-slate-400">
        {chLabel}
      </div>

      {/* Page enabled toggle (ch2/ch3) */}
      {channel !== 1 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-teal-400" />
              Page Visibility
            </CardTitle>
            <CardDescription className="text-slate-400">
              Controls whether this channel appears in the navigation bar. Users can navigate to /live-{channel} directly even when hidden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Toggle value={pageEnabled} onChange={setPageEnabled} activeColor="bg-teal-500" />
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setPageEnabled(v => !v)}>
                Channel {channel} nav link is <strong className={pageEnabled ? 'text-teal-400' : 'text-slate-400'}>{pageEnabled ? 'visible' : 'hidden'}</strong>
              </Label>
            </div>
            {pageEnabled && (
              <p className="mt-2 text-xs text-teal-400/70">
                "Livestream {channel}" will appear in the navbar. If it's also live, a red LIVE badge will be shown.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mux stream */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Tv2 className="h-4 w-4 text-red-400" />
              Mux Default Stream
            </CardTitle>
            <div className="flex items-center gap-2">
              {muxIsLive && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1 animate-pulse"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> LIVE</Badge>}
              {muxIsFree && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">FREE</Badge>}
            </div>
          </div>
          <CardDescription className="text-slate-400">
            The Mux video feed for this channel. Toggle it live to activate the paywall — mark it free to let everyone watch without paying.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Mux Playback ID</Label>
            <Input value={muxPlaybackId} onChange={e => setMuxPlaybackId(e.target.value)}
              placeholder="QEQX7ir02QjD1eYSV00vdTr8waLZof6bisQLNWzom00sZ00"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm" disabled={isLoading} />
            <p className="text-xs text-slate-500">The ID from your Mux dashboard — e.g. <code className="text-teal-400">player.mux.com/<strong>YOUR_ID</strong></code></p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Stream Title</Label>
            <Input value={muxTitle} onChange={e => setMuxTitle(e.target.value)} placeholder="ATA Live Stream"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm" disabled={isLoading} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Thumbnail URL</Label>
            <div className="flex items-center gap-2">
              <Input value={muxThumbnailUrl} onChange={e => setMuxThumbnailUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm font-mono" disabled={isLoading} />
              <Button type="button" variant="outline" size="sm" onClick={() => muxThumbInputRef.current?.click()}
                className="shrink-0 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              <input ref={muxThumbInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const fd = new FormData(); fd.append('thumbnail', file);
                const r = await fetch('/api/uploads/thumbnail', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                if (r.ok) { const d = await r.json(); setMuxThumbnailUrl(d.url); toast.success('Thumbnail uploaded'); }
                else toast.error('Upload failed');
              }} />
            </div>
            {muxThumbnailUrl && <div className="w-24 h-14 rounded overflow-hidden border border-slate-700"><img src={muxThumbnailUrl} alt="thumbnail" className="w-full h-full object-cover" /></div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player A</Label>
              <Input value={muxPlayerA} onChange={e => setMuxPlayerA(e.target.value)} placeholder="Serge Mulumba" className="bg-slate-800 border-slate-700 text-white text-sm" disabled={isLoading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player A Country <span className="text-slate-500 text-xs">(2-letter code)</span></Label>
              <Input value={muxPlayerACountry} onChange={e => setMuxPlayerACountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="UG" maxLength={2} className="bg-slate-800 border-slate-700 text-white text-sm uppercase" disabled={isLoading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player B</Label>
              <Input value={muxPlayerB} onChange={e => setMuxPlayerB(e.target.value)} placeholder="Erik Katamba" className="bg-slate-800 border-slate-700 text-white text-sm" disabled={isLoading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player B Country <span className="text-slate-500 text-xs">(2-letter code)</span></Label>
              <Input value={muxPlayerBCountry} onChange={e => setMuxPlayerBCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="CD" maxLength={2} className="bg-slate-800 border-slate-700 text-white text-sm uppercase" disabled={isLoading} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Access Price (USD)</Label>
            <div className="flex items-center gap-2 w-36">
              <span className="text-slate-400 text-sm">$</span>
              <Input type="number" min="0" step="0.50" value={muxPrice} onChange={e => setMuxPrice(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm" disabled={isLoading || muxIsFree} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Toggle value={muxIsLive} onChange={(v) => { if (v) setYtIsLive(false); setMuxIsLive(v); }} />
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => { setMuxIsLive(v => { if (!v) setYtIsLive(false); return !v; }); }}>
                Stream is <strong className={muxIsLive ? 'text-red-400' : 'text-slate-400'}>{muxIsLive ? 'LIVE' : 'offline'}</strong>
                {muxIsLive ? ' — paywall is active' : ' — no paywall'}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Toggle value={muxIsFree} onChange={setMuxIsFree} activeColor="bg-emerald-500" />
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setMuxIsFree(v => !v)}>
                Free stream — <span className={muxIsFree ? 'text-emerald-400' : 'text-slate-400'}>{muxIsFree ? 'anyone can watch without paying' : 'paywall applies when live'}</span>
              </Label>
            </div>
          </div>

          {muxIsLive && !muxIsFree && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Paywall is <strong>ON</strong>. Users must pay ${muxPrice || '1.50'} from their wallet for access.</span>
            </div>
          )}

          <div className="pt-1">
            <Button onClick={saveMuxSettings} disabled={saveMutation.isPending || syncingMux || isLoading}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending || syncingMux ? 'Saving…' : 'Save Mux Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* YouTube stream */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-500" />
              YouTube Live Feed
            </CardTitle>
            <div className="flex items-center gap-2">
              {ytIsLive && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1 animate-pulse"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> LIVE</Badge>}
              {ytIsFree && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">FREE</Badge>}
            </div>
          </div>
          <CardDescription className="text-slate-400">
            Backup feed from a YouTube live stream (public or unlisted). Only one of Mux or YouTube can be active at a time per channel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">YouTube Video ID or URL</Label>
            <Input value={ytVideoId} onChange={e => setYtVideoId(e.target.value)}
              placeholder="dQw4w9WgXcQ  or  https://youtu.be/dQw4w9WgXcQ"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm" disabled={isLoading} />
            <p className="text-xs text-slate-500">Paste the full YouTube URL or just the 11-character video ID.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Stream Title</Label>
            <Input value={ytTitle} onChange={e => setYtTitle(e.target.value)} placeholder="ATA Live Stream"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm" disabled={isLoading} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Thumbnail URL</Label>
            <div className="flex items-center gap-2">
              <Input value={ytThumbnailUrl} onChange={e => setYtThumbnailUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm font-mono" disabled={isLoading} />
              <Button type="button" variant="outline" size="sm" onClick={() => ytThumbInputRef.current?.click()}
                className="shrink-0 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              <input ref={ytThumbInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const fd = new FormData(); fd.append('thumbnail', file);
                const r = await fetch('/api/uploads/thumbnail', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                if (r.ok) { const d = await r.json(); setYtThumbnailUrl(d.url); toast.success('Thumbnail uploaded'); }
                else toast.error('Upload failed');
              }} />
            </div>
            {ytThumbnailUrl && <div className="w-24 h-14 rounded overflow-hidden border border-slate-700"><img src={ytThumbnailUrl} alt="thumbnail" className="w-full h-full object-cover" /></div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player A</Label>
              <Input value={ytPlayerA} onChange={e => setYtPlayerA(e.target.value)} placeholder="Serge Mulumba" className="bg-slate-800 border-slate-700 text-white text-sm" disabled={isLoading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player A Country <span className="text-slate-500 text-xs">(2-letter code)</span></Label>
              <Input value={ytPlayerACountry} onChange={e => setYtPlayerACountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="UG" maxLength={2} className="bg-slate-800 border-slate-700 text-white text-sm uppercase" disabled={isLoading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player B</Label>
              <Input value={ytPlayerB} onChange={e => setYtPlayerB(e.target.value)} placeholder="Erik Katamba" className="bg-slate-800 border-slate-700 text-white text-sm" disabled={isLoading} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Player B Country <span className="text-slate-500 text-xs">(2-letter code)</span></Label>
              <Input value={ytPlayerBCountry} onChange={e => setYtPlayerBCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="CD" maxLength={2} className="bg-slate-800 border-slate-700 text-white text-sm uppercase" disabled={isLoading} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Access Price (USD)</Label>
            <div className="flex items-center gap-2 w-36">
              <span className="text-slate-400 text-sm">$</span>
              <Input type="number" min="0" step="0.50" value={ytPrice} onChange={e => setYtPrice(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm" disabled={isLoading || ytIsFree} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Toggle value={ytIsLive} onChange={(v) => { if (v) setMuxIsLive(false); setYtIsLive(v); }} />
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => { setYtIsLive(v => { if (!v) setMuxIsLive(false); return !v; }); }}>
                Stream is <strong className={ytIsLive ? 'text-red-400' : 'text-slate-400'}>{ytIsLive ? 'LIVE' : 'offline'}</strong>
                {ytIsLive ? ' — paywall is active' : ' — no paywall'}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Toggle value={ytIsFree} onChange={setYtIsFree} activeColor="bg-emerald-500" />
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setYtIsFree(v => !v)}>
                Free stream — <span className={ytIsFree ? 'text-emerald-400' : 'text-slate-400'}>{ytIsFree ? 'anyone can watch without paying' : 'paywall applies when live'}</span>
              </Label>
            </div>
          </div>

          {ytIsLive && !ytIsFree && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Paywall is <strong>ON</strong>. Users must pay ${ytPrice || '1.50'} from their wallet for access.</span>
            </div>
          )}

          {muxIsLive && ytIsLive && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span><strong>Conflict:</strong> Both Mux and YouTube are marked live. Turn off one before saving.</span>
            </div>
          )}

          <div className="pt-1">
            <Button onClick={saveYtSettings} disabled={saveMutation.isPending || syncingYt || isLoading || (muxIsLive && ytIsLive)}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending || syncingYt ? 'Saving…' : 'Save YouTube Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminLivestreamSettings() {
  useEffect(() => { document.title = 'Livestream Settings - Admin - ATA Platform'; }, []);

  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();
  const [selectedChannel, setSelectedChannel] = useState<1 | 2 | 3>(1);

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

  const tabs: { channel: 1 | 2 | 3; label: string; path: string }[] = [
    { channel: 1, label: 'Channel 1', path: '/live' },
    { channel: 2, label: 'Channel 2', path: '/live-2' },
    { channel: 3, label: 'Channel 3', path: '/live-3' },
  ];

  const isLive = (ch: 1 | 2 | 3) => {
    if (!settings) return false;
    const p = ch === 1 ? '' : `ch${ch}_`;
    return settings[`${p}mux_is_live`] === 'true' || settings[`${p}yt_is_live`] === 'true';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Livestream Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Configure up to 3 independent live channels</p>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-800/60 border border-slate-700 p-1 w-fit">
        {tabs.map(({ channel, label, path }) => {
          const active = selectedChannel === channel;
          const live = isLive(channel);
          return (
            <button
              key={channel}
              type="button"
              onClick={() => setSelectedChannel(channel)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${active ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
            >
              {label}
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">{path}</span>
              {live && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
            </button>
          );
        })}
      </div>

      {/* Channel form */}
      {settings && (
        <ChannelForm
          key={selectedChannel}
          channel={selectedChannel}
          settings={settings}
          token={token}
          qc={qc}
          isLoading={isLoading}
          saveMutation={saveMutation}
        />
      )}

      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-800 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
