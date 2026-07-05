import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Radio, Save, AlertCircle, Tv2, Upload } from 'lucide-react';
import { toast } from 'sonner';

function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });
}

export default function AdminLivestreamSettings() {
  useEffect(() => { document.title = 'Livestream Settings - Admin - ATA Platform'; }, []);

  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();

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
    if (settings) {
      setMuxPlaybackId(settings.mux_playback_id ?? '');
      setMuxIsLive(settings.mux_is_live === 'true');
      setMuxIsFree(settings.mux_is_free === 'true');
      setMuxPrice(settings.mux_price ?? '1.50');
      setMuxTitle(settings.mux_title ?? '');
      setMuxThumbnailUrl(settings.mux_thumbnail_url ?? '');
      setMuxPlayerA(settings.mux_player_a ?? '');
      setMuxPlayerB(settings.mux_player_b ?? '');
      setMuxPlayerACountry(settings.mux_player_a_country ?? '');
      setMuxPlayerBCountry(settings.mux_player_b_country ?? '');
      setYtVideoId(settings.yt_video_id ?? '');
      setYtIsLive(settings.yt_is_live === 'true');
      setYtIsFree(settings.yt_is_free === 'true');
      setYtPrice(settings.yt_price ?? '1.50');
      setYtTitle(settings.yt_title ?? '');
      setYtThumbnailUrl(settings.yt_thumbnail_url ?? '');
      setYtPlayerA(settings.yt_player_a ?? '');
      setYtPlayerB(settings.yt_player_b ?? '');
      setYtPlayerACountry(settings.yt_player_a_country ?? '');
      setYtPlayerBCountry(settings.yt_player_b_country ?? '');
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
      mux_thumbnail_url: muxThumbnailUrl.trim(),
      mux_player_a: muxPlayerA.trim(),
      mux_player_b: muxPlayerB.trim(),
      mux_player_a_country: muxPlayerACountry.trim().toUpperCase().slice(0, 2),
      mux_player_b_country: muxPlayerBCountry.trim().toUpperCase().slice(0, 2),
    });
    setSyncingMux(true);
    try {
      const r = await fetch('/api/settings/sync-mux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
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

  const saveYtSettings = async () => {
    const videoId = extractYouTubeId(ytVideoId.trim());
    if (!videoId) { toast.error('YouTube Video ID or URL is required'); return; }
    if (!isValidYtId(videoId)) { toast.error('Could not extract a valid YouTube video ID — paste the full URL or the 11-character ID'); return; }
    const priceNum = parseFloat(ytPrice);
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Enter a valid price (0 for free)'); return; }
    await saveMutation.mutateAsync({
      yt_video_id: videoId,
      yt_is_live: ytIsLive ? 'true' : 'false',
      yt_is_free: ytIsFree ? 'true' : 'false',
      yt_price: priceNum.toFixed(2),
      yt_title: ytTitle.trim() || 'ATA Live Stream',
      yt_thumbnail_url: ytThumbnailUrl.trim(),
      yt_player_a: ytPlayerA.trim(),
      yt_player_b: ytPlayerB.trim(),
      yt_player_a_country: ytPlayerACountry.trim().toUpperCase().slice(0, 2),
      yt_player_b_country: ytPlayerBCountry.trim().toUpperCase().slice(0, 2),
    });
    setSyncingYt(true);
    try {
      const r = await fetch('/api/settings/sync-yt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
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
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Livestream Settings</h1>
          <p className="text-slate-400 text-sm mt-0.5">Configure Mux and YouTube live stream feeds</p>
        </div>
      </div>

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

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Thumbnail URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={muxThumbnailUrl}
                onChange={e => setMuxThumbnailUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm font-mono"
                disabled={isLoading}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => muxThumbInputRef.current?.click()} className="shrink-0 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              <input ref={muxThumbInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
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

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setMuxIsLive(v => { if (!v) setYtIsLive(false); return !v; }); }}
                className={`relative w-10 h-5 rounded-full transition-colors ${muxIsLive ? 'bg-red-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${muxIsLive ? 'translate-x-5' : ''}`} />
              </button>
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => { setMuxIsLive(v => { if (!v) setYtIsLive(false); return !v; }); }}>
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

      {/* ── YouTube Live Stream ── */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-500" />
              YouTube Live Feed
            </CardTitle>
            <div className="flex items-center gap-2">
              {ytIsLive && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> LIVE
                </Badge>
              )}
              {ytIsFree && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">FREE</Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-slate-400">
            Backup feed from a YouTube live stream (public or unlisted). Displayed in the same player slot as Mux —
            only one can be active at a time. YouTube branding is suppressed in the embedded player.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">YouTube Video ID or URL</Label>
            <Input
              value={ytVideoId}
              onChange={e => setYtVideoId(e.target.value)}
              placeholder="dQw4w9WgXcQ  or  https://youtu.be/dQw4w9WgXcQ"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">
              Paste the full YouTube URL or just the 11-character video ID. Works with public and unlisted streams.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Stream Title</Label>
            <Input
              value={ytTitle}
              onChange={e => setYtTitle(e.target.value)}
              placeholder="ATA Live Stream"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">Shown in the paywall overlay and stream info bar.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Thumbnail URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={ytThumbnailUrl}
                onChange={e => setYtThumbnailUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm font-mono"
                disabled={isLoading}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => ytThumbInputRef.current?.click()} className="shrink-0 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              <input ref={ytThumbInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
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
              <Input
                type="number"
                min="0"
                step="0.50"
                value={ytPrice}
                onChange={e => setYtPrice(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                disabled={isLoading || ytIsFree}
              />
            </div>
            <p className="text-xs text-slate-500">Charged from the user's wallet for 24-hour access.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setYtIsLive(v => { if (!v) setMuxIsLive(false); return !v; }); }}
                className={`relative w-10 h-5 rounded-full transition-colors ${ytIsLive ? 'bg-red-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ytIsLive ? 'translate-x-5' : ''}`} />
              </button>
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => { setYtIsLive(v => { if (!v) setMuxIsLive(false); return !v; }); }}>
                Stream is <strong className={ytIsLive ? 'text-red-400' : 'text-slate-400'}>{ytIsLive ? 'LIVE' : 'offline'}</strong>
                {ytIsLive ? ' — paywall is active' : ' — no paywall'}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setYtIsFree(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${ytIsFree ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ytIsFree ? 'translate-x-5' : ''}`} />
              </button>
              <Label className="text-slate-300 text-sm cursor-pointer" onClick={() => setYtIsFree(v => !v)}>
                Free stream — <span className={ytIsFree ? 'text-emerald-400' : 'text-slate-400'}>
                  {ytIsFree ? 'anyone can watch without paying' : 'paywall applies when live'}
                </span>
              </Label>
            </div>
          </div>

          {ytIsLive && !ytIsFree && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Paywall is <strong>ON</strong>. Users must pay ${ytPrice || '1.50'} from their wallet for 24-hour access. Toggle "Free stream" to let everyone watch for free.</span>
            </div>
          )}

          {muxIsLive && ytIsLive && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span><strong>Conflict:</strong> Both Mux and YouTube are marked live. Turn off one before saving — they cannot run simultaneously.</span>
            </div>
          )}

          <div className="pt-1">
            <Button
              onClick={saveYtSettings}
              disabled={saveMutation.isPending || syncingYt || isLoading || (muxIsLive && ytIsLive)}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending || syncingYt ? 'Saving…' : 'Save YouTube Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
