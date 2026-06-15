import React, { useEffect, useRef, useState } from 'react';
import { useListStreams, useCreateStream, useGoLive, useEndStream } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Radio, Plus, Play, Square, Upload, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListStreamsQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  live: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  ended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const SPORTS = ['pool', 'boxing', 'football', 'athletics', 'basketball', 'tournament'];

const EMPTY_FORM = {
  title: '', description: '', sport: 'pool', startTime: '', endTime: '', accessPrice: '1.50',
  playerA: '', playerB: '',
};

export default function AdminStreams() {
  useEffect(() => { document.title = 'Manage Streams - Admin'; }, []);

  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  const [showForm, setShowForm] = useState(false);
  const [goLiveId, setGoLiveId] = useState<number | null>(null);
  const [hlsUrl, setHlsUrl] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: streamsData, isLoading } = useListStreams({ limit: 50 });
  const createStream = useCreateStream();
  const goLive = useGoLive();
  const endStream = useEndStream();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStreamsQueryKey() });

  const isTournament = form.sport === 'tournament';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadThumbnail = async (): Promise<string | null> => {
    if (!thumbnailFile) return null;
    const formData = new FormData();
    formData.append('thumbnail', thumbnailFile);
    const resp = await fetch('/api/uploads/thumbnail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Thumbnail upload failed');
    }
    const { url } = await resp.json();
    return url;
  };

  const handleCreate = async () => {
    if (!form.title || !form.sport || !form.startTime) {
      toast.error('Title, sport, and start time required');
      return;
    }
    if (!isTournament && (!form.playerA || !form.playerB)) {
      toast.error('Player A and Player B are required for non-tournament streams');
      return;
    }
    try {
      setUploading(true);
      const thumbnailUrl = await uploadThumbnail();
      await createStream.mutateAsync({
        data: {
          title: form.title,
          description: form.description,
          sport: form.sport,
          startTime: form.startTime,
          endTime: form.endTime || undefined,
          accessPrice: parseFloat(form.accessPrice),
          thumbnailUrl: thumbnailUrl ?? undefined,
          playerA: isTournament ? undefined : form.playerA,
          playerB: isTournament ? undefined : form.playerB,
        } as any,
      });
      invalidate();
      toast.success(`Stream created${isTournament ? '' : ' — a matching game was also created'}`);
      setShowForm(false);
      setForm(EMPTY_FORM);
      clearThumbnail();
    } catch (err: any) {
      toast.error(err?.message || err?.data?.error || 'Failed to create stream');
    } finally {
      setUploading(false);
    }
  };

  const handleGoLive = async (id: number) => {
    if (!hlsUrl) { toast.error('Enter HLS URL'); return; }
    try {
      await goLive.mutateAsync({ id, data: { hlsUrl } });
      invalidate();
      toast.success('Stream is now LIVE');
      setGoLiveId(null);
      setHlsUrl('');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to go live');
    }
  };

  const handleEnd = async (id: number) => {
    try {
      await endStream.mutateAsync({ id });
      invalidate();
      toast.success('Stream ended');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to end stream');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radio className="h-6 w-6 text-teal-400" /> Manage Streams
        </h1>
        <Button onClick={() => setShowForm(!showForm)} className="bg-teal-500 hover:bg-teal-400 text-slate-950">
          <Plus className="h-4 w-4 mr-1" /> New Stream
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-teal-500/30">
          <CardHeader><CardTitle className="text-white">Create Stream</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1">
              <Label className="text-slate-300">Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            {/* Sport */}
            <div className="space-y-1">
              <Label className="text-slate-300">Sport</Label>
              <select
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value, playerA: '', playerB: '' })}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm capitalize"
              >
                {SPORTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>

            {/* Player fields — hidden for tournaments */}
            {!isTournament && (
              <>
                <div className="space-y-1">
                  <Label className="text-slate-300">Player A</Label>
                  <Input value={form.playerA} onChange={(e) => setForm({ ...form, playerA: e.target.value })} placeholder="e.g. John Doe" className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Player B</Label>
                  <Input value={form.playerB} onChange={(e) => setForm({ ...form, playerB: e.target.value })} placeholder="e.g. Jane Doe" className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </>
            )}

            {/* Start / End time */}
            <div className="space-y-1">
              <Label className="text-slate-300">Start Time</Label>
              <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">End Time</Label>
              <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            {/* Access price */}
            <div className="space-y-1">
              <Label className="text-slate-300">Access Price ($)</Label>
              <Input type="number" step="0.01" value={form.accessPrice} onChange={(e) => setForm({ ...form, accessPrice: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            {/* Thumbnail upload */}
            <div className="space-y-1">
              <Label className="text-slate-300">Thumbnail</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Upload className="h-4 w-4 mr-1" /> Upload Image
                </Button>
                {thumbnailPreview && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearThumbnail} className="text-slate-400 hover:text-red-400 px-1">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {thumbnailPreview && (
                <div className="mt-2 relative w-32 h-20 rounded-md overflow-hidden border border-slate-700">
                  <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2 space-y-1">
              <Label className="text-slate-300">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            {!isTournament && (
              <p className="md:col-span-2 text-xs text-teal-400/80">
                A matching game will be automatically created for betting when this stream is saved.
              </p>
            )}

            <div className="md:col-span-2 flex gap-3">
              <Button onClick={handleCreate} disabled={createStream.isPending || uploading} className="bg-teal-500 hover:bg-teal-400 text-slate-950">
                {uploading || createStream.isPending ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowForm(false); clearThumbnail(); setForm(EMPTY_FORM); }} className="text-slate-400">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(streamsData?.streams || []).map((stream: any) => (
            <Card key={stream.id} className="bg-slate-900 border-primary/20">
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-14 h-10 rounded overflow-hidden bg-slate-800 flex items-center justify-center">
                    {stream.thumbnailUrl ? (
                      <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${STATUS_COLORS[stream.status] || 'bg-slate-700 text-slate-300'} border text-xs`}>{stream.status}</Badge>
                      <span className="text-xs text-slate-500 capitalize">{stream.sport}</span>
                    </div>
                    <p className="text-white font-semibold truncate">{stream.title}</p>
                    <p className="text-xs text-slate-400">{new Date(stream.startTime).toLocaleString()} · ${stream.accessPrice}/day</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {stream.status === 'upcoming' && (
                    goLiveId === stream.id ? (
                      <div className="flex gap-2 items-center">
                        <Input value={hlsUrl} onChange={(e) => setHlsUrl(e.target.value)} placeholder="HLS URL..." className="bg-slate-800 border-slate-700 text-white w-48 h-8 text-xs" />
                        <Button size="sm" onClick={() => handleGoLive(stream.id)} className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-8 text-xs">Go Live</Button>
                        <Button size="sm" variant="ghost" onClick={() => setGoLiveId(null)} className="text-slate-400 h-8 text-xs">Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setGoLiveId(stream.id)} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 h-8 text-xs">
                        <Play className="h-3 w-3 mr-1" /> Go Live
                      </Button>
                    )
                  )}
                  {stream.status === 'live' && (
                    <Button size="sm" variant="destructive" onClick={() => handleEnd(stream.id)} className="h-8 text-xs">
                      <Square className="h-3 w-3 mr-1" /> End
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
