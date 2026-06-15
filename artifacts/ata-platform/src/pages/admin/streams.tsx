import React, { useEffect, useRef, useState } from 'react';
import { useListStreams, useCreateStream, useUpdateStream, useGoLive, useEndStream } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Radio, Plus, Play, Square, Upload, X, ImageIcon, Pencil } from 'lucide-react';
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

function defaultStartTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

const EMPTY_FORM = {
  title: '', description: '', sport: 'pool',
  startTime: defaultStartTime(), endTime: '',
  accessPrice: '1.50', playerA: '', playerB: '', city: '', country: '',
};

function toLocalDatetime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StreamForm({
  form, setForm, isTournament, thumbnailPreview, fileInputRef,
  onFileChange, onClearThumb, onSave, onCancel, saving, title, accentClass,
}: any) {
  return (
    <Card className={`bg-slate-900 border ${accentClass}`}>
      <CardHeader><CardTitle className="text-white">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-slate-300">Title <span className="text-red-400">*</span></Label>
          <Input value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Kampala Pool Championship" className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Sport <span className="text-red-400">*</span></Label>
          <select value={form.sport} onChange={(e: any) => setForm({ ...form, sport: e.target.value, playerA: '', playerB: '' })}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm capitalize">
            {SPORTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        {!isTournament && (<>
          <div className="space-y-1">
            <Label className="text-slate-300">Player A <span className="text-red-400">*</span></Label>
            <Input value={form.playerA} onChange={(e: any) => setForm({ ...form, playerA: e.target.value })} placeholder="e.g. John Doe" className="bg-slate-800 border-slate-700 text-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Player B <span className="text-red-400">*</span></Label>
            <Input value={form.playerB} onChange={(e: any) => setForm({ ...form, playerB: e.target.value })} placeholder="e.g. Jane Doe" className="bg-slate-800 border-slate-700 text-white" />
          </div>
        </>)}

        <div className="space-y-1">
          <Label className="text-slate-300">{isTournament ? 'Start Date & Time' : 'Date & Time'} <span className="text-red-400">*</span></Label>
          <Input type="datetime-local" value={form.startTime} onChange={(e: any) => setForm({ ...form, startTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">{isTournament ? 'End Date & Time' : 'End Time (optional)'}</Label>
          <Input type="datetime-local" value={form.endTime} onChange={(e: any) => setForm({ ...form, endTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>

        <div className="space-y-1">
          <Label className="text-slate-300">City</Label>
          <Input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Kampala" className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Country</Label>
          <Input value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} placeholder="e.g. Uganda" className="bg-slate-800 border-slate-700 text-white" />
        </div>

        <div className="space-y-1">
          <Label className="text-slate-300">Access Price (USD/day)</Label>
          <Input type="number" step="0.01" value={form.accessPrice} onChange={(e: any) => setForm({ ...form, accessPrice: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>

        {onFileChange && (
          <div className="space-y-1">
            <Label className="text-slate-300">Thumbnail</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <Upload className="h-4 w-4 mr-1" /> Upload Image
              </Button>
              {thumbnailPreview && (
                <Button type="button" variant="ghost" size="sm" onClick={onClearThumb} className="text-slate-400 hover:text-red-400 px-1">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFileChange} />
            </div>
            {thumbnailPreview && (
              <div className="mt-2 w-32 h-20 rounded-md overflow-hidden border border-slate-700">
                <img src={thumbnailPreview} alt="preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        <div className="md:col-span-2 space-y-1">
          <Label className="text-slate-300">Description</Label>
          <Input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>

        {!isTournament && onFileChange && (
          <p className="md:col-span-2 text-xs text-teal-400/80">
            A matching game will be automatically created for betting when this stream is saved.
          </p>
        )}

        <div className="md:col-span-2 flex gap-3">
          <Button onClick={onSave} disabled={saving} className="bg-teal-500 hover:bg-teal-400 text-slate-950">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminStreams() {
  useEffect(() => { document.title = 'Manage Streams - Admin'; }, []);

  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [goLiveId, setGoLiveId] = useState<number | null>(null);
  const [hlsUrl, setHlsUrl] = useState('');

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const { data: streamsData, isLoading } = useListStreams({ limit: 50 });
  const createStream = useCreateStream();
  const updateStream = useUpdateStream();
  const goLive = useGoLive();
  const endStream = useEndStream();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStreamsQueryKey() });

  const isTournament = form.sport === 'tournament';
  const editIsTournament = editForm.sport === 'tournament';

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
    const fd = new FormData();
    fd.append('thumbnail', thumbnailFile);
    const r = await fetch('/api/uploads/thumbnail', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
    return (await r.json()).url;
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditThumbnailFile(file);
    setEditThumbnailPreview(URL.createObjectURL(file));
  };
  const clearEditThumbnail = () => {
    setEditThumbnailFile(null);
    setEditThumbnailPreview(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };
  const uploadEditThumbnail = async (): Promise<string | null> => {
    if (!editThumbnailFile) return null;
    const fd = new FormData();
    fd.append('thumbnail', editThumbnailFile);
    const r = await fetch('/api/uploads/thumbnail', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
    return (await r.json()).url;
  };

  const validateCreate = () => {
    if (!form.title.trim()) { toast.error('Please enter a stream title'); return false; }
    if (!form.startTime) { toast.error('Please set a start date and time'); return false; }
    if (!isTournament && !form.playerA.trim()) { toast.error('Please enter Player A name'); return false; }
    if (!isTournament && !form.playerB.trim()) { toast.error('Please enter Player B name'); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!validateCreate()) return;
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
          city: form.city || undefined,
          country: form.country || undefined,
        } as any,
      });
      invalidate();
      toast.success(`Stream created${isTournament ? '' : ' — a matching game was also created'}`);
      setShowForm(false);
      setForm({ ...EMPTY_FORM, startTime: defaultStartTime() });
      clearThumbnail();
    } catch (e: any) {
      toast.error(e?.message || e?.data?.error || 'Failed to create stream');
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (stream: any) => {
    setEditId(stream.id);
    setEditForm({
      title: stream.title || '',
      description: stream.description || '',
      sport: stream.sport || 'pool',
      startTime: toLocalDatetime(stream.startTime),
      endTime: toLocalDatetime(stream.endTime),
      accessPrice: String(stream.accessPrice ?? '1.50'),
      playerA: '',
      playerB: '',
      city: stream.city || '',
      country: stream.country || '',
    });
    clearEditThumbnail();
    setEditThumbnailPreview(stream.thumbnailUrl || null);
    setShowForm(false);
  };

  const handleEdit = async () => {
    if (!editForm.title.trim()) { toast.error('Title is required'); return; }
    if (!editForm.startTime) { toast.error('Start date and time is required'); return; }
    try {
      setEditSaving(true);
      const newThumbnailUrl = await uploadEditThumbnail();
      await updateStream.mutateAsync({
        id: editId!,
        data: {
          title: editForm.title,
          description: editForm.description,
          sport: editForm.sport,
          startTime: editForm.startTime,
          endTime: editForm.endTime || undefined,
          accessPrice: parseFloat(editForm.accessPrice),
          city: editForm.city || undefined,
          country: editForm.country || undefined,
          ...(newThumbnailUrl ? { thumbnailUrl: newThumbnailUrl } : {}),
        } as any,
      });
      invalidate();
      toast.success('Stream updated');
      setEditId(null);
      clearEditThumbnail();
    } catch (e: any) {
      toast.error(e?.data?.error || 'Failed to update stream');
    } finally {
      setEditSaving(false);
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
    } catch (e: any) {
      toast.error(e?.data?.error || 'Failed');
    }
  };

  const handleEnd = async (id: number) => {
    try {
      await endStream.mutateAsync({ id });
      invalidate();
      toast.success('Stream ended');
    } catch (e: any) {
      toast.error(e?.data?.error || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radio className="h-6 w-6 text-teal-400" /> Manage Streams
        </h1>
        <Button
          onClick={() => { setShowForm(!showForm); setEditId(null); }}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950"
        >
          <Plus className="h-4 w-4 mr-1" /> New Stream
        </Button>
      </div>

      {showForm && (
        <StreamForm
          form={form} setForm={setForm} isTournament={isTournament}
          thumbnailPreview={thumbnailPreview} fileInputRef={fileInputRef}
          onFileChange={handleFileChange} onClearThumb={clearThumbnail}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); clearThumbnail(); setForm({ ...EMPTY_FORM, startTime: defaultStartTime() }); }}
          saving={createStream.isPending || uploading}
          title="Create Stream" accentClass="border-teal-500/30"
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(streamsData?.streams || []).map((stream: any) => (
            <div key={stream.id}>
              <Card className={`bg-slate-900 border-primary/20 ${editId === stream.id ? 'border-amber-500/40' : ''}`}>
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-14 h-10 rounded overflow-hidden bg-slate-800 flex items-center justify-center">
                      {stream.thumbnailUrl
                        ? <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
                        : <ImageIcon className="h-5 w-5 text-slate-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${STATUS_COLORS[stream.status] || 'bg-slate-700 text-slate-300'} border text-xs`}>
                          {stream.status}
                        </Badge>
                        <span className="text-xs text-slate-500 capitalize">{stream.sport}</span>
                      </div>
                      <p className="text-white font-semibold truncate">{stream.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(stream.startTime).toLocaleString()}
                        {stream.endTime ? ` → ${new Date(stream.endTime).toLocaleString()}` : ''}
                        {(stream.city || stream.country) ? ` · ${[stream.city, stream.country].filter(Boolean).join(', ')}` : ''}
                        {` · $${stream.accessPrice}/day`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 items-center">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => editId === stream.id ? setEditId(null) : startEdit(stream)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-amber-400"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {stream.status === 'upcoming' && (
                      goLiveId === stream.id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            value={hlsUrl} onChange={(e) => setHlsUrl(e.target.value)}
                            placeholder="HLS URL…"
                            className="bg-slate-800 border-slate-700 text-white w-48 h-8 text-xs"
                          />
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
              {editId === stream.id && (
                <div className="mt-2">
                  <StreamForm
                    form={editForm} setForm={setEditForm} isTournament={editIsTournament}
                    thumbnailPreview={editThumbnailPreview} fileInputRef={editFileInputRef}
                    onFileChange={handleEditFileChange} onClearThumb={clearEditThumbnail}
                    onSave={handleEdit} onCancel={() => { setEditId(null); clearEditThumbnail(); }}
                    saving={editSaving} title="Edit Stream" accentClass="border-amber-500/30"
                  />
                </div>
              )}
            </div>
          ))}
          {(!streamsData?.streams || streamsData.streams.length === 0) && (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No streams yet. Create one above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
