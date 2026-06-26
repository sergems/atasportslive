import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ImagePlus, Save, Trash2, ExternalLink, LayoutTemplate, CheckCircle2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const AD_SLOTS = [
  { key: 'left_1',  label: 'Left Column — Top',    position: 'Desktop left sidebar, top slot' },
  { key: 'left_2',  label: 'Left Column — Bottom',  position: 'Desktop left sidebar, bottom slot' },
  { key: 'right_1', label: 'Right Column — Top',   position: 'Desktop right sidebar, top slot' },
  { key: 'right_2', label: 'Right Column — Bottom', position: 'Desktop right sidebar, bottom slot' },
] as const;

type SlotKey = typeof AD_SLOTS[number]['key'];

interface AdSlotState {
  image: string;
  link: string;
  enabled: boolean;
}

function settingsKey(slot: SlotKey, field: 'image' | 'link' | 'enabled') {
  return `ad_slot_${slot}_${field}`;
}

function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });
}

function AdSlotCard({
  slot,
  state,
  onChange,
  onSave,
  saving,
}: {
  slot: typeof AD_SLOTS[number];
  state: AdSlotState;
  onChange: (field: keyof AdSlotState, value: string | boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const token = useAuthStore((s) => s.token);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('thumbnail', file);
      const res = await fetch('/api/uploads/thumbnail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const { url } = await res.json();
      onChange('image', url);
      toast.success('Image uploaded — click Save to apply.');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-teal-400" />
              {slot.label}
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs mt-0.5">{slot.position}</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {state.enabled ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Active
              </Badge>
            ) : (
              <Badge className="bg-slate-700 text-slate-400 border-slate-600">Inactive</Badge>
            )}
            <button
              type="button"
              onClick={() => onChange('enabled', !state.enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${state.enabled ? 'bg-teal-500' : 'bg-slate-700'}`}
              aria-label="Toggle slot"
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${state.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image preview + upload */}
        <div className="space-y-2">
          <Label className="text-slate-300 text-sm">Ad Image</Label>
          {state.image ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
              <img
                src={state.image}
                alt="Ad preview"
                className="w-full h-40 object-cover"
              />
              <button
                type="button"
                onClick={() => onChange('image', '')}
                className="absolute top-2 right-2 flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                title="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 cursor-pointer hover:border-teal-500/40 hover:bg-slate-800 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-8 w-8 text-slate-600" />
              <p className="text-slate-500 text-sm">Click to upload an ad image</p>
              <p className="text-slate-600 text-xs">JPEG, PNG, WebP · Max 5 MB</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="border-slate-700 text-slate-300 hover:text-white gap-2 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : state.image ? 'Replace Image' : 'Upload Image'}
            </Button>
          </div>
        </div>

        {/* Link URL */}
        <div className="space-y-1.5">
          <Label className="text-slate-300 text-sm flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" /> Click-through URL (optional)
          </Label>
          <Input
            value={state.link}
            onChange={(e) => onChange('link', e.target.value)}
            placeholder="https://advertiser.com"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 text-sm"
          />
          <p className="text-xs text-slate-500">Leave blank to make the ad non-clickable.</p>
        </div>

        <Button
          onClick={onSave}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold gap-2 w-full"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Slot'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminAds() {
  useEffect(() => { document.title = 'Ad Slots - Admin - ATA Platform'; }, []);

  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();

  const [slotStates, setSlotStates] = useState<Record<SlotKey, AdSlotState>>({
    left_1:  { image: '', link: '', enabled: true },
    left_2:  { image: '', link: '', enabled: true },
    right_1: { image: '', link: '', enabled: true },
    right_2: { image: '', link: '', enabled: true },
  });

  useEffect(() => {
    if (!settings) return;
    setSlotStates({
      left_1:  { image: settings['ad_slot_left_1_image'] ?? '',  link: settings['ad_slot_left_1_link'] ?? '',  enabled: settings['ad_slot_left_1_enabled'] !== 'false' },
      left_2:  { image: settings['ad_slot_left_2_image'] ?? '',  link: settings['ad_slot_left_2_link'] ?? '',  enabled: settings['ad_slot_left_2_enabled'] !== 'false' },
      right_1: { image: settings['ad_slot_right_1_image'] ?? '', link: settings['ad_slot_right_1_link'] ?? '', enabled: settings['ad_slot_right_1_enabled'] !== 'false' },
      right_2: { image: settings['ad_slot_right_2_image'] ?? '', link: settings['ad_slot_right_2_link'] ?? '', enabled: settings['ad_slot_right_2_enabled'] !== 'false' },
    });
  }, [settings]);

  const [saving, setSaving] = useState<SlotKey | null>(null);

  const saveSlot = async (slotKey: SlotKey) => {
    setSaving(slotKey);
    try {
      const s = slotStates[slotKey];
      const updates = {
        [settingsKey(slotKey, 'image')]:   s.image,
        [settingsKey(slotKey, 'link')]:    s.link,
        [settingsKey(slotKey, 'enabled')]: s.enabled ? 'true' : 'false',
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['ad-slots'] });
      toast.success(`${AD_SLOTS.find(s => s.key === slotKey)?.label} saved.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const handleChange = (slotKey: SlotKey, field: keyof AdSlotState, value: string | boolean) => {
    setSlotStates(prev => ({
      ...prev,
      [slotKey]: { ...prev[slotKey], [field]: value },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Loading ad slots…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <ImagePlus className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Ad Slots</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage the advertisement panels on the Upcoming Events page</p>
        </div>
      </div>

      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3 text-sm text-teal-300 flex items-start gap-2">
        <LayoutTemplate className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">How it works</p>
          <p className="text-teal-400/80 text-xs mt-0.5">
            Upload an image to each slot and optionally add a click-through URL. Enable/disable slots individually.
            Changes appear immediately on the <strong>/upcoming</strong> page. Disabled or empty slots revert to the default placeholder.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {AD_SLOTS.map((slot) => (
          <AdSlotCard
            key={slot.key}
            slot={slot}
            state={slotStates[slot.key]}
            onChange={(field, value) => handleChange(slot.key, field, value)}
            onSave={() => saveSlot(slot.key)}
            saving={saving === slot.key}
          />
        ))}
      </div>
    </div>
  );
}
