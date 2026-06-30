import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ImagePlus, Save, Trash2, ExternalLink, LayoutTemplate, CheckCircle2, Upload, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { FALLBACK_SLOTS } from '@/components/ads';

const AD_SLOTS = [
  { key: 'left_1',  label: 'Left Column — Top',       position: 'Desktop left sidebar, slot 1 (top)' },
  { key: 'left_2',  label: 'Left Column — Middle',     position: 'Desktop left sidebar, slot 2 (middle)' },
  { key: 'left_3',  label: 'Left Column — Bottom',     position: 'Desktop left sidebar, slot 3 (bottom)' },
  { key: 'right_1', label: 'Right Column — Top',       position: 'Desktop right sidebar, slot 1 (top)' },
  { key: 'right_2', label: 'Right Column — Middle',    position: 'Desktop right sidebar, slot 2 (middle)' },
  { key: 'right_3', label: 'Right Column — Bottom',    position: 'Desktop right sidebar, slot 3 (bottom)' },
] as const;

type SlotKey = typeof AD_SLOTS[number]['key'];

interface AdSlotState {
  image: string;
  link: string;
  enabled: boolean;
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
  const fallback = FALLBACK_SLOTS[slot.key];

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
              <LayoutTemplate className={`h-4 w-4`} style={{ color: fallback.badge.includes('teal') ? '#2dd4bf' : fallback.badge.includes('amber') ? '#fbbf24' : fallback.badge.includes('emerald') ? '#34d399' : fallback.badge.includes('violet') ? '#a78bfa' : fallback.badge.includes('red') ? '#f87171' : '#60a5fa' }} />
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
        <div className="space-y-2">
          <Label className="text-slate-300 text-sm">Ad Image</Label>
          {state.image ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
              <img src={state.image} alt="Ad preview" className="w-full h-36 object-cover" />
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
              className="flex flex-col items-center justify-center gap-2 h-36 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 cursor-pointer hover:border-teal-500/40 hover:bg-slate-800 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-7 w-7 text-slate-600" />
              <p className="text-slate-500 text-sm">Click to upload</p>
              <p className="text-slate-600 text-xs">JPEG, PNG, WebP · Max 5 MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileUpload} />
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

  const emptySlot = (): AdSlotState => ({ image: '', link: '', enabled: true });

  const [slotStates, setSlotStates] = useState<Record<SlotKey, AdSlotState>>({
    left_1: emptySlot(), left_2: emptySlot(), left_3: emptySlot(),
    right_1: emptySlot(), right_2: emptySlot(), right_3: emptySlot(),
  });
  const [hideOnMobile, setHideOnMobile] = useState(false);
  const [savingMobile, setSavingMobile] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const parse = (key: string): AdSlotState => ({
      image:   settings[`ad_slot_${key}_image`] ?? '',
      link:    settings[`ad_slot_${key}_link`] ?? '',
      enabled: settings[`ad_slot_${key}_enabled`] !== 'false',
    });
    setSlotStates({
      left_1: parse('left_1'), left_2: parse('left_2'), left_3: parse('left_3'),
      right_1: parse('right_1'), right_2: parse('right_2'), right_3: parse('right_3'),
    });
    setHideOnMobile(settings['ads_hide_on_mobile'] === 'true');
  }, [settings]);

  const saveMobileSetting = async (value: boolean) => {
    setSavingMobile(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ads_hide_on_mobile: value ? 'true' : 'false' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['ad-slots'] });
      toast.success(value ? 'Ads hidden on mobile.' : 'Ads shown on mobile.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
      setHideOnMobile(!value); // revert
    } finally {
      setSavingMobile(false);
    }
  };

  const toggleMobile = () => {
    const next = !hideOnMobile;
    setHideOnMobile(next);
    saveMobileSetting(next);
  };

  const [saving, setSaving] = useState<SlotKey | null>(null);

  const saveSlot = async (slotKey: SlotKey) => {
    setSaving(slotKey);
    try {
      const s = slotStates[slotKey];
      const updates = {
        [`ad_slot_${slotKey}_image`]:   s.image,
        [`ad_slot_${slotKey}_link`]:    s.link,
        [`ad_slot_${slotKey}_enabled`]: s.enabled ? 'true' : 'false',
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
    setSlotStates(prev => ({ ...prev, [slotKey]: { ...prev[slotKey], [field]: value } }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">Loading ad slots…</div>
      </div>
    );
  }

  const leftSlots  = AD_SLOTS.filter(s => s.key.startsWith('left_'));
  const rightSlots = AD_SLOTS.filter(s => s.key.startsWith('right_'));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ImagePlus className="h-6 w-6 text-teal-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Ad Slots</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage the 6 advertisement panels on the Upcoming & Fixtures pages</p>
        </div>
      </div>

      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3 text-sm text-teal-300 flex items-start gap-2">
        <LayoutTemplate className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">6 slots — 3 left, 3 right</p>
          <p className="text-teal-400/80 text-xs mt-0.5">
            Upload an image and optionally add a click-through URL. Toggle slots on/off individually.
            Changes appear immediately on <strong>/upcoming</strong> and <strong>/fixtures</strong>.
            Empty or disabled slots show a default sponsor placeholder.
          </p>
        </div>
      </div>

      {/* Mobile ads toggle */}
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 shrink-0">
              <Smartphone className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Hide ads on mobile</p>
              <p className="text-slate-500 text-xs mt-0.5">
                When on, ads are hidden on all mobile screens. Desktop sidebar ads are unaffected.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {hideOnMobile ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hidden sm:flex">Hidden on mobile</Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hidden sm:flex">Shown on mobile</Badge>
            )}
            <button
              type="button"
              onClick={toggleMobile}
              disabled={savingMobile}
              className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${hideOnMobile ? 'bg-amber-500' : 'bg-teal-500'}`}
              aria-label="Toggle mobile ads"
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hideOnMobile ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Left Sidebar</p>
          {leftSlots.map((slot) => (
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

        {/* Right column */}
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Right Sidebar</p>
          {rightSlots.map((slot) => (
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
    </div>
  );
}
