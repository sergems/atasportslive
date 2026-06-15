import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clapperboard, Plus, Pencil, Trash2, Check, X, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';

interface Highlight {
  id: number;
  title: string;
  description: string;
  youtubeUrl: string;
  isPublished: boolean;
  createdAt: string;
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1].split('?')[0];
      return u.searchParams.get('v');
    }
  } catch {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

const EMPTY_FORM = { title: '', description: '', youtubeUrl: '', isPublished: true };

function useHighlights() {
  const token = useAuthStore((s) => s.token);
  return useQuery<Highlight[]>({
    queryKey: ['highlights', 'all'],
    queryFn: async () => {
      const r = await fetch('/api/highlights/all', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });
}

function useHighlightMutation(method: 'POST' | 'PATCH' | 'DELETE', id?: number) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: any) => {
      const url = id ? `/api/highlights/${id}` : '/api/highlights';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
      return r.json().catch(() => null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['highlights'] });
    },
  });
}

function HighlightForm({ form, setForm, onSave, onCancel, saving, title, accent }: any) {
  const videoId = extractYoutubeId(form.youtubeUrl);
  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <Card className={`bg-slate-900 border ${accent}`}>
      <CardHeader><CardTitle className="text-white">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-slate-300">Title</Label>
          <Input
            value={form.title}
            onChange={(e: any) => setForm({ ...form, title: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="e.g. Pool Championship Final Highlights"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label className="text-slate-300 flex items-center gap-1.5">
            <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube URL
          </Label>
          <Input
            value={form.youtubeUrl}
            onChange={(e: any) => setForm({ ...form, youtubeUrl: e.target.value })}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
          />
          {form.youtubeUrl && !videoId && (
            <p className="text-red-400 text-xs">Could not extract a valid YouTube video ID from this URL.</p>
          )}
        </div>

        {thumb && (
          <div className="md:col-span-2">
            <Label className="text-slate-300 mb-1 block">Preview</Label>
            <img src={thumb} alt="thumbnail" className="h-32 rounded-lg object-cover border border-slate-700" />
          </div>
        )}

        <div className="md:col-span-2 space-y-1">
          <Label className="text-slate-300">Description</Label>
          <textarea
            value={form.description}
            onChange={(e: any) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="Brief description of the match or event..."
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e: any) => setForm({ ...form, isPublished: e.target.checked })}
              className="accent-amber-500 w-4 h-4"
            />
            <span className="text-slate-300 text-sm">Published (visible to all users)</span>
          </label>
        </div>

        <div className="md:col-span-2 flex gap-3">
          <Button onClick={onSave} disabled={saving || !videoId} className="bg-amber-500 hover:bg-amber-400 text-slate-950">
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({ h, onEdit, editing }: { h: Highlight; onEdit: () => void; editing: boolean }) {
  const deleteMut = useHighlightMutation('DELETE', h.id);
  const toggleMut = useHighlightMutation('PATCH', h.id);
  const videoId = extractYoutubeId(h.youtubeUrl);
  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  const handleDelete = async () => {
    if (!confirm('Delete this highlight?')) return;
    try {
      await deleteMut.mutateAsync();
      toast.success('Deleted');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async () => {
    try {
      await toggleMut.mutateAsync({ isPublished: !h.isPublished });
      toast.success(h.isPublished ? 'Hidden from highlights' : 'Now visible to users');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className={`bg-slate-900 border-primary/20 ${editing ? 'border-amber-500/40' : ''}`}>
      <CardContent className="py-4 px-5 flex items-start gap-4">
        {thumb && (
          <img src={thumb} alt={h.title} className="h-16 w-28 rounded-lg object-cover shrink-0 border border-slate-700" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={h.isPublished ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs' : 'bg-slate-700/50 text-slate-500 border border-slate-700 text-xs'}>
              {h.isPublished ? 'Published' : 'Draft'}
            </Badge>
            <span className="text-xs text-slate-600">{new Date(h.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-white font-semibold text-sm truncate">{h.title}</p>
          {h.description && <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{h.description}</p>}
          <p className="text-slate-600 text-xs font-mono mt-1 truncate">{h.youtubeUrl}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={handleToggle} title={h.isPublished ? 'Unpublish' : 'Publish'} className="h-7 w-7 p-0 text-slate-400 hover:text-teal-400">
            {h.isPublished ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleteMut.isPending} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EditHighlightForm({ id, form, setForm, onCancel }: { id: number; form: any; setForm: any; onCancel: () => void }) {
  const updateMut = useHighlightMutation('PATCH', id);
  const handleSave = async () => {
    if (!form.title || !form.youtubeUrl) { toast.error('Title and YouTube URL required'); return; }
    try {
      await updateMut.mutateAsync(form);
      toast.success('Updated');
      onCancel();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="mt-2">
      <HighlightForm form={form} setForm={setForm} onSave={handleSave} onCancel={onCancel} saving={updateMut.isPending} title="Edit Highlight" accent="border-amber-500/30" />
    </div>
  );
}

export default function AdminHighlights() {
  useEffect(() => { document.title = 'Highlights - Admin'; }, []);

  const { data: highlights, isLoading } = useHighlights();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMut = useHighlightMutation('POST');

  const startEdit = (h: Highlight) => {
    setEditId(h.id);
    setForm({ title: h.title, description: h.description, youtubeUrl: h.youtubeUrl, isPublished: h.isPublished });
    setShowForm(false);
  };
  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM); };

  const handleCreate = async () => {
    if (!form.title || !form.youtubeUrl) { toast.error('Title and YouTube URL required'); return; }
    try {
      await createMut.mutateAsync(form);
      toast.success('Highlight created');
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clapperboard className="h-6 w-6 text-amber-400" /> Highlights
        </h1>
        <Button onClick={() => { setShowForm(!showForm); cancelEdit(); }} className="bg-amber-500 hover:bg-amber-400 text-slate-950">
          <Plus className="h-4 w-4 mr-1" /> New Highlight
        </Button>
      </div>

      {showForm && (
        <HighlightForm
          form={form}
          setForm={setForm}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          saving={createMut.isPending}
          title="Create Highlight"
          accent="border-amber-500/30"
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 bg-slate-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(highlights || []).map((h) => (
            <div key={h.id}>
              <HighlightCard h={h} onEdit={() => startEdit(h)} editing={editId === h.id} />
              {editId === h.id && (
                <EditHighlightForm id={h.id} form={form} setForm={setForm} onCancel={cancelEdit} />
              )}
            </div>
          ))}
          {(!highlights || highlights.length === 0) && !showForm && (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl text-sm">
              No highlights yet. Create one by pasting a YouTube link.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
