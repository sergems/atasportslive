import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';

interface Announcement {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

const EMPTY_FORM = { title: '', content: '', isActive: true, priority: 0 };

function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const r = await fetch('/api/announcements');
      return r.json();
    },
  });
}

function useAnnMutation(method: 'POST' | 'PATCH' | 'DELETE', id?: number) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: any) => {
      const url = id ? `/api/announcements/${id}` : '/api/announcements';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
      return r.json().catch(() => null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export default function AdminAnnouncements() {
  useEffect(() => { document.title = 'Announcements - Admin'; }, []);

  const { data: announcements, isLoading } = useAnnouncements();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMut = useAnnMutation('POST');

  const startEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({ title: a.title, content: a.content, isActive: a.isActive, priority: a.priority });
    setShowForm(false);
  };

  const cancelEdit = () => { setEditId(null); setForm(EMPTY_FORM); };

  const handleCreate = async () => {
    if (!form.title || !form.content) { toast.error('Title and content required'); return; }
    try {
      await createMut.mutateAsync(form);
      toast.success('Announcement created');
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-orange-400" /> Announcements
        </h1>
        <Button onClick={() => { setShowForm(!showForm); cancelEdit(); }} className="bg-orange-500 hover:bg-orange-400 text-slate-950">
          <Plus className="h-4 w-4 mr-1" /> New Announcement
        </Button>
      </div>

      {showForm && (
        <AnnouncementForm
          form={form}
          setForm={setForm}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          saving={createMut.isPending}
          title="Create Announcement"
          accent="border-orange-500/30"
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 bg-slate-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(announcements || []).map((a) => (
            <div key={a.id}>
              <AnnouncementCard
                announcement={a}
                onEdit={() => startEdit(a)}
                editing={editId === a.id}
              />
              {editId === a.id && (
                <EditAnnouncementForm
                  id={a.id}
                  form={form}
                  setForm={setForm}
                  onCancel={cancelEdit}
                />
              )}
            </div>
          ))}
          {(!announcements || announcements.length === 0) && (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No announcements yet. Create one to display it on the home page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnnouncementForm({ form, setForm, onSave, onCancel, saving, title, accent }: any) {
  return (
    <Card className={`bg-slate-900 border ${accent}`}>
      <CardHeader><CardTitle className="text-white">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 space-y-1">
          <Label className="text-slate-300">Title</Label>
          <Input value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="e.g. Platform Maintenance Tonight" />
        </div>
        <div className="md:col-span-2 space-y-1">
          <Label className="text-slate-300">Content</Label>
          <textarea
            value={form.content}
            onChange={(e: any) => setForm({ ...form, content: e.target.value })}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="Announcement body..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Priority (higher = shown first)</Label>
          <Input type="number" value={form.priority} onChange={(e: any) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e: any) => setForm({ ...form, isActive: e.target.checked })} className="accent-teal-500 w-4 h-4" />
            <span className="text-slate-300 text-sm">Active (visible on home page)</span>
          </label>
        </div>
        <div className="md:col-span-2 flex gap-3">
          <Button onClick={onSave} disabled={saving} className="bg-orange-500 hover:bg-orange-400 text-slate-950">{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnnouncementCard({ announcement: a, onEdit, editing }: { announcement: Announcement; onEdit: () => void; editing: boolean }) {
  const deleteMut = useAnnMutation('DELETE', a.id);
  const toggleMut = useAnnMutation('PATCH', a.id);
  const qc = useQueryClient();

  const handleDelete = async () => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteMut.mutateAsync(undefined as any);
      toast.success('Deleted');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async () => {
    try {
      await toggleMut.mutateAsync({ isActive: !a.isActive });
      toast.success(a.isActive ? 'Hidden from home page' : 'Now visible on home page');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className={`bg-slate-900 border-primary/20 ${editing ? 'border-orange-500/40' : ''}`}>
      <CardContent className="py-4 px-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={a.isActive ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs' : 'bg-slate-700/50 text-slate-500 border border-slate-700 text-xs'}>
              {a.isActive ? 'Active' : 'Hidden'}
            </Badge>
            <span className="text-xs text-slate-500">Priority: {a.priority}</span>
            <span className="text-xs text-slate-600">{new Date(a.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-white font-semibold truncate">{a.title}</p>
          <p className="text-slate-400 text-sm mt-0.5 line-clamp-2">{a.content}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={handleToggle} title={a.isActive ? 'Hide' : 'Show'} className="h-7 w-7 p-0 text-slate-400 hover:text-teal-400">
            {a.isActive ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
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

function EditAnnouncementForm({ id, form, setForm, onCancel }: { id: number; form: any; setForm: any; onCancel: () => void }) {
  const updateMut = useAnnMutation('PATCH', id);
  const handleSave = async () => {
    if (!form.title || !form.content) { toast.error('Title and content required'); return; }
    try {
      await updateMut.mutateAsync(form);
      toast.success('Updated');
      onCancel();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="mt-2">
      <AnnouncementForm form={form} setForm={setForm} onSave={handleSave} onCancel={onCancel} saving={updateMut.isPending} title="Edit Announcement" accent="border-amber-500/30" />
    </div>
  );
}
