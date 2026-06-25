import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, Plus, Pencil, Trash2, Check, X, Upload, GripVertical, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';

interface Slide {
  id: number;
  title: string;
  subtitle: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  buttonText: '',
  buttonUrl: '',
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};

function useSlides() {
  const token = useAuthStore((s) => s.token);
  return useQuery<Slide[]>({
    queryKey: ['hero-slides', 'all'],
    queryFn: async () => {
      const r = await fetch('/api/slides/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });
}

function useSlideMutation(method: 'POST' | 'PATCH' | 'DELETE', id?: number) {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body?: any) => {
      const url = id ? `/api/slides/${id}` : '/api/slides';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
      return r.json().catch(() => null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hero-slides'] });
    },
  });
}

function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const token = useAuthStore((s) => s.token);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('thumbnail', file);
      const r = await fetch('/api/uploads/thumbnail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error('Upload failed');
      const { url } = await r.json();
      onChange(url);
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-slate-300">Background Image</Label>
      <div
        className="relative border-2 border-dashed border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:border-teal-500/50 transition-colors"
        style={{ minHeight: 120 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {value ? (
          <div className="relative">
            <img src={value} alt="Slide preview" className="w-full h-40 object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-sm font-medium">Click to change</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-500">
            <Upload className="h-6 w-6" />
            <span className="text-sm">{uploading ? 'Uploading...' : 'Click or drag to upload image'}</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value && (
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white text-xs font-mono"
            placeholder="/uploads/..."
          />
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onChange(''); }} className="text-slate-400 hover:text-red-400 px-2">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SlideForm({ form, setForm, onSave, onCancel, saving, title, accent }: any) {
  return (
    <Card className={`bg-slate-900 border ${accent}`}>
      <CardHeader><CardTitle className="text-white text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <Label className="text-slate-300">Title <span className="text-red-400">*</span></Label>
            <Input
              value={form.title}
              onChange={(e: any) => setForm({ ...form, title: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
              placeholder="e.g. The Nerve Center of African Sports"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-slate-300">Subtitle</Label>
            <textarea
              value={form.subtitle}
              onChange={(e: any) => setForm({ ...form, subtitle: e.target.value })}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="Short description shown below the title..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Button Text</Label>
            <Input
              value={form.buttonText}
              onChange={(e: any) => setForm({ ...form, buttonText: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
              placeholder="e.g. Join the Exchange"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Button URL</Label>
            <Input
              value={form.buttonUrl}
              onChange={(e: any) => setForm({ ...form, buttonUrl: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white"
              placeholder="e.g. /register"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Sort Order (lower = first)</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e: any) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e: any) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-teal-500 w-4 h-4"
              />
              <span className="text-slate-300 text-sm">Active (show on homepage)</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <ImageUploader value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={onSave} disabled={saving} className="bg-teal-600 hover:bg-teal-500 text-white">
            {saving ? 'Saving...' : 'Save Slide'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SlideCard({ slide: s, onEdit, editing }: { slide: Slide; onEdit: () => void; editing: boolean }) {
  const deleteMut = useSlideMutation('DELETE', s.id);
  const toggleMut = useSlideMutation('PATCH', s.id);

  const handleDelete = async () => {
    if (!confirm('Delete this slide?')) return;
    try { await deleteMut.mutateAsync(); toast.success('Slide deleted'); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleToggle = async () => {
    try {
      await toggleMut.mutateAsync({ isActive: !s.isActive });
      toast.success(s.isActive ? 'Slide hidden' : 'Slide now visible');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className={`bg-slate-900 border-primary/20 overflow-hidden ${editing ? 'border-teal-500/40' : ''}`}>
      <CardContent className="p-0 flex items-stretch">
        {s.imageUrl ? (
          <div className="w-32 shrink-0">
            <img src={s.imageUrl} alt={s.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-32 shrink-0 bg-slate-800 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-slate-600" />
          </div>
        )}
        <div className="flex-1 px-5 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className={s.isActive
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs'
                : 'bg-slate-700/50 text-slate-500 border border-slate-700 text-xs'}>
                {s.isActive ? 'Active' : 'Hidden'}
              </Badge>
              <span className="text-xs text-slate-500">Order: {s.sortOrder}</span>
            </div>
            <p className="text-white font-semibold truncate">{s.title}</p>
            {s.subtitle && <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">{s.subtitle}</p>}
            {s.buttonText && s.buttonUrl && (
              <p className="text-xs text-teal-500 mt-1">
                Button: "{s.buttonText}" → {s.buttonUrl}
              </p>
            )}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={handleToggle} title={s.isActive ? 'Hide' : 'Show'} className="h-7 w-7 p-0 text-slate-400 hover:text-teal-400">
              {s.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit} className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleteMut.isPending} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSlides() {
  useEffect(() => { document.title = 'Hero Slides - Admin'; }, []);

  const { data: slides, isLoading } = useSlides();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const createMut = useSlideMutation('POST');

  const startEdit = (s: Slide) => {
    setEditId(s.id);
    setForm({
      title: s.title,
      subtitle: s.subtitle || '',
      buttonText: s.buttonText || '',
      buttonUrl: s.buttonUrl || '',
      imageUrl: s.imageUrl || '',
      sortOrder: s.sortOrder,
      isActive: s.isActive,
    });
    setShowForm(false);
  };

  const cancelEdit = () => { setEditId(null); setForm({ ...EMPTY_FORM }); };

  const handleCreate = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    try {
      await createMut.mutateAsync(form);
      toast.success('Slide created');
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-teal-400" /> Hero Slides
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage the animated hero slider shown on the homepage.</p>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); cancelEdit(); }}
          className="bg-teal-600 hover:bg-teal-500 text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> New Slide
        </Button>
      </div>

      {showForm && (
        <SlideForm
          form={form}
          setForm={setForm}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }}
          saving={createMut.isPending}
          title="Create Slide"
          accent="border-teal-500/30"
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 bg-slate-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(slides || []).map((s) => (
            <div key={s.id}>
              <SlideCard slide={s} onEdit={() => startEdit(s)} editing={editId === s.id} />
              {editId === s.id && (
                <div className="mt-2">
                  <EditSlideForm id={s.id} form={form} setForm={setForm} onCancel={cancelEdit} />
                </div>
              )}
            </div>
          ))}
          {(!slides || slides.length === 0) && (
            <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No slides yet. Create one to replace the default hero on the homepage.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditSlideForm({ id, form, setForm, onCancel }: { id: number; form: any; setForm: any; onCancel: () => void }) {
  const updateMut = useSlideMutation('PATCH', id);
  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    try {
      await updateMut.mutateAsync(form);
      toast.success('Slide updated');
      onCancel();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <SlideForm
      form={form}
      setForm={setForm}
      onSave={handleSave}
      onCancel={onCancel}
      saving={updateMut.isPending}
      title="Edit Slide"
      accent="border-amber-500/30"
    />
  );
}
