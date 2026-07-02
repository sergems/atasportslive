import React, { useEffect, useRef, useState } from 'react';
import { useCreateStream, useUpdateStream, useGoLive, useEndStream, useDeleteStream } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Radio, Plus, Play, Square, Upload, X, ImageIcon, Pencil, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
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
      <CardHeader className="py-2 px-3 border-b border-slate-800">
        <CardTitle className="text-white text-xs uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Title <span className="text-red-400">*</span></Label>
          <Input value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Kampala Pool Championship" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Sport <span className="text-red-400">*</span></Label>
          <select value={form.sport} onChange={(e: any) => setForm({ ...form, sport: e.target.value, playerA: '', playerB: '' })}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-0 h-8 text-white text-xs capitalize focus-visible:ring-1 focus-visible:ring-teal-500/50 outline-none">
            {SPORTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        {!isTournament && (<>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player A <span className="text-red-400">*</span></Label>
            <Input value={form.playerA} onChange={(e: any) => setForm({ ...form, playerA: e.target.value })} placeholder="e.g. John Doe" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player B <span className="text-red-400">*</span></Label>
            <Input value={form.playerB} onChange={(e: any) => setForm({ ...form, playerB: e.target.value })} placeholder="e.g. Jane Doe" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
        </>)}

        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isTournament ? 'Start Date & Time' : 'Date & Time'} <span className="text-red-400">*</span></Label>
          <Input type="datetime-local" value={form.startTime} onChange={(e: any) => setForm({ ...form, startTime: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isTournament ? 'End Date & Time' : 'End Time (opt)'}</Label>
          <Input type="datetime-local" value={form.endTime} onChange={(e: any) => setForm({ ...form, endTime: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">City</Label>
          <Input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Kampala" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Country</Label>
          <Input value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} placeholder="e.g. Uganda" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Price (USD)</Label>
          <Input type="number" step="0.01" value={form.accessPrice} onChange={(e: any) => setForm({ ...form, accessPrice: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        {onFileChange && (
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Thumbnail</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs">
                <Upload className="h-3 w-3 mr-1" /> Upload
              </Button>
              {thumbnailPreview && (
                <Button type="button" variant="ghost" size="sm" onClick={onClearThumb} className="h-8 px-2 text-slate-400 hover:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFileChange} />
            </div>
            {thumbnailPreview && (
              <div className="mt-1.5 w-24 h-16 rounded overflow-hidden border border-slate-700">
                <img src={thumbnailPreview} alt="preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        )}

        <div className="md:col-span-2 space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Description</Label>
          <Input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        {!isTournament && onFileChange && (
          <p className="md:col-span-2 text-[10px] text-teal-400/80">
            Matching game will be automatically created for betting.
          </p>
        )}

        <div className="md:col-span-2 flex gap-2 mt-1">
          <Button size="sm" onClick={onSave} disabled={saving} className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-8 px-4 text-xs font-bold">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 px-3 text-xs">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StreamRow({
  stream, editId, setEditId, startEdit, editForm, setEditForm, editIsTournament,
  editThumbnailPreview, editFileInputRef, handleEditFileChange, clearEditThumbnail,
  handleEdit, editSaving, goLiveId, setGoLiveId, hlsUrl, setHlsUrl,
  handleGoLive, handleEnd, handleDelete,
}: any) {
  return (
    <div>
      <Card className={`bg-slate-900 border-slate-800 ${editId === stream.id ? 'border-amber-500/40' : ''}`}>
        <CardContent className="py-2 px-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 w-full">
            <div className="flex-shrink-0 w-16 h-10 rounded overflow-hidden bg-slate-800/50 flex items-center justify-center border border-slate-800">
              {stream.thumbnailUrl
                ? <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
                : <ImageIcon className="h-4 w-4 text-slate-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`px-1.5 py-0 rounded-full border text-[9px] font-bold uppercase tracking-wider ${STATUS_COLORS[stream.status] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {stream.status}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">{stream.sport}</span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-xs truncate">{stream.title}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span>{new Date(stream.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                {stream.endTime && <span>→ {new Date(stream.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}
                {(stream.city || stream.country) && <span>· {[stream.city, stream.country].filter(Boolean).join(', ')}</span>}
                <span className="text-amber-400 font-mono font-bold">· ${stream.accessPrice}/d</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t border-slate-800 sm:border-0 pt-2 sm:pt-0 shrink-0">
            <Button
              size="sm" variant="ghost"
              onClick={() => editId === stream.id ? setEditId(null) : startEdit(stream)}
              className="h-7 w-7 p-0 text-slate-500 hover:text-amber-400 bg-slate-800/50 hover:bg-amber-500/10 rounded"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            
            {stream.status === 'upcoming' && (
              goLiveId === stream.id ? (
                <div className="flex gap-1.5 items-center">
                  <Input
                    value={hlsUrl} onChange={(e: any) => setHlsUrl(e.target.value)}
                    placeholder="HLS URL…"
                    className="bg-slate-950 border-slate-700 text-white w-32 h-7 text-[10px]"
                  />
                  <Button size="sm" onClick={() => handleGoLive(stream.id)} className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-7 px-2 text-[10px] font-bold">Go</Button>
                  <Button size="sm" variant="ghost" onClick={() => setGoLiveId(null)} className="h-7 w-7 p-0 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setGoLiveId(stream.id)} className="bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border border-teal-500/30 h-7 px-2 text-[10px] font-bold uppercase tracking-wider">
                  <Play className="h-3 w-3 mr-1" /> Live
                </Button>
              )
            )}
            
            {stream.status === 'live' && (
              <Button size="sm" variant="destructive" onClick={() => handleEnd(stream.id)} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider">
                <Square className="h-3 w-3 mr-1" /> End
              </Button>
            )}
            
            <Button
              size="sm" variant="ghost"
              onClick={() => handleDelete(stream.id, stream.title)}
              className="h-7 w-7 p-0 text-slate-600 hover:text-red-400 bg-slate-800/50 hover:bg-red-500/10 rounded"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
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

  const { data: streamsData, isLoading } = useQuery({
    queryKey: ['streams', 'all'],
    queryFn: () =>
      fetch('/api/streams?limit=200&include_all=true', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()) as Promise<{ streams: any[] }>,
  });
  const createStream = useCreateStream();
  const updateStream = useUpdateStream();
  const goLive = useGoLive();
  const endStream = useEndStream();
  const deleteStream = useDeleteStream();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['streams'] });

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

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteStream.mutateAsync({ id });
      invalidate();
      toast.success('Stream deleted');
    } catch (e: any) {
      toast.error(e?.data?.error || 'Failed to delete');
    }
  };

  const allStreams: any[] = streamsData?.streams || [];
  const activeStreams = allStreams.filter((s) => s.status !== 'ended');
  const pastStreams = allStreams.filter((s) => s.status === 'ended');

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
        <>
          {/* Active Streams */}
          <div className="space-y-3">
            {activeStreams.map((stream: any) => (
              <StreamRow
                key={stream.id} stream={stream}
                editId={editId} setEditId={setEditId}
                startEdit={startEdit} editForm={editForm} setEditForm={setEditForm}
                editIsTournament={editIsTournament} editThumbnailPreview={editThumbnailPreview}
                editFileInputRef={editFileInputRef} handleEditFileChange={handleEditFileChange}
                clearEditThumbnail={clearEditThumbnail} handleEdit={handleEdit} editSaving={editSaving}
                goLiveId={goLiveId} setGoLiveId={setGoLiveId} hlsUrl={hlsUrl} setHlsUrl={setHlsUrl}
                handleGoLive={handleGoLive} handleEnd={handleEnd} handleDelete={handleDelete}
              />
            ))}
            {activeStreams.length === 0 && (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No active streams yet. Create one above.
              </div>
            )}
          </div>

          {/* Past Streams */}
          {pastStreams.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-slate-800" />
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-widest">
                  <Archive className="h-3.5 w-3.5" /> Past Streams ({pastStreams.length})
                </div>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              {pastStreams.map((stream: any) => (
                <StreamRow
                  key={stream.id} stream={stream}
                  editId={editId} setEditId={setEditId}
                  startEdit={startEdit} editForm={editForm} setEditForm={setEditForm}
                  editIsTournament={editIsTournament} editThumbnailPreview={editThumbnailPreview}
                  editFileInputRef={editFileInputRef} handleEditFileChange={handleEditFileChange}
                  clearEditThumbnail={clearEditThumbnail} handleEdit={handleEdit} editSaving={editSaving}
                  goLiveId={goLiveId} setGoLiveId={setGoLiveId} hlsUrl={hlsUrl} setHlsUrl={setHlsUrl}
                  handleGoLive={handleGoLive} handleEnd={handleEnd} handleDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
