import React, { useEffect, useRef, useState } from 'react';
import { useCreateStream, useUpdateStream, useGoLive, useEndStream, useDeleteStream } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Radio, Plus, Play, Square, Upload, X, ImageIcon, Pencil, Trash2,
  ChevronDown, ChevronRight, Trophy, Swords, Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  live:     'bg-teal-500/20 text-teal-400 border-teal-500/30',
  ended:    'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const SPORTS = ['pool', 'boxing', 'darts', 'fifa', 'chess', 'futsal'];

type StreamType = 'single' | 'competition';

interface StreamFormData {
  type: StreamType;
  title: string;
  description: string;
  sport: string;
  startTime: string;
  endTime: string;
  accessPrice: string;
  playerA: string;
  playerB: string;
  playerACountry: string;
  playerBCountry: string;
  city: string;
  country: string;
}

function defaultStartTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

const EMPTY_SINGLE: StreamFormData = {
  type: 'single', title: '', description: '', sport: 'pool',
  startTime: defaultStartTime(), endTime: '',
  accessPrice: '1.50', playerA: '', playerB: '',
  playerACountry: '', playerBCountry: '',
  city: '', country: '',
};

const EMPTY_COMPETITION: StreamFormData = {
  type: 'competition', title: '', description: '', sport: 'pool',
  startTime: defaultStartTime(), endTime: '',
  accessPrice: '1.50', playerA: '', playerB: '',
  playerACountry: '', playerBCountry: '',
  city: '', country: '',
};

function toLocalDatetime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ─── StreamForm ───────────────────────────────────────────────────── */
function StreamForm({
  form, setForm,
  isChild = false,
  thumbnailPreview, fileInputRef, onFileChange, onClearThumb,
  createGame, setCreateGame,
  onSave, onCancel, saving, title, accentClass,
  parentStream,
}: {
  form: StreamFormData; setForm: (f: StreamFormData) => void;
  isChild?: boolean;
  thumbnailPreview?: string | null; fileInputRef?: React.RefObject<HTMLInputElement | null>;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearThumb?: () => void;
  createGame?: boolean; setCreateGame?: (v: boolean) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; title: string; accentClass: string;
  parentStream?: any;
}) {
  const isCompetition = form.type === 'competition';

  return (
    <Card className={`bg-slate-900 border ${accentClass}`}>
      <CardHeader className="py-2 px-3 border-b border-slate-800">
        <CardTitle className="text-white text-xs uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Type selector — only on top-level create */}
        {!isChild && (
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs text-slate-400">Type</Label>
            <div className="flex gap-2">
              {(['single', 'competition'] as StreamType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...(t === 'competition' ? EMPTY_COMPETITION : EMPTY_SINGLE), type: t })}
                  className={`flex-1 py-1.5 px-3 rounded border text-[10px] font-bold uppercase tracking-wider transition-colors
                    ${form.type === t
                      ? t === 'competition'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                  {t === 'single' ? 'Single Stream' : 'Competition'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">
            {isCompetition ? 'Competition Name' : 'Title'} <span className="text-red-400">*</span>
          </Label>
          <Input
            value={form.title}
            onChange={(e: any) => setForm({ ...form, title: e.target.value })}
            placeholder={isCompetition ? 'e.g. Kampala Pool Championship 2026' : 'e.g. Serge vs Erik – Quarter Final'}
            className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50"
          />
        </div>

        {/* Sport */}
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Sport <span className="text-red-400">*</span></Label>
          <select
            value={form.sport}
            onChange={(e: any) => setForm({ ...form, sport: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 h-8 text-white text-xs capitalize focus-visible:ring-1 focus-visible:ring-teal-500/50 outline-none"
          >
            {SPORTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        {/* Player fields — single streams only */}
        {!isCompetition && (<>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player A <span className="text-red-400">*</span></Label>
            <Input value={form.playerA} onChange={(e: any) => setForm({ ...form, playerA: e.target.value })} placeholder="e.g. Serge Mulumba" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player A Country</Label>
            <Input value={form.playerACountry} onChange={(e: any) => setForm({ ...form, playerACountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UG" maxLength={2} className="bg-slate-950 border-slate-800 text-white h-8 text-xs uppercase focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player B <span className="text-red-400">*</span></Label>
            <Input value={form.playerB} onChange={(e: any) => setForm({ ...form, playerB: e.target.value })} placeholder="e.g. Erik Katamba" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player B Country</Label>
            <Input value={form.playerBCountry} onChange={(e: any) => setForm({ ...form, playerBCountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="KE" maxLength={2} className="bg-slate-950 border-slate-800 text-white h-8 text-xs uppercase focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
        </>)}

        {/* Timing */}
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isCompetition ? 'Start Date & Time' : 'Date & Time'} <span className="text-red-400">*</span></Label>
          <Input type="datetime-local" value={form.startTime} onChange={(e: any) => setForm({ ...form, startTime: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isCompetition ? 'End Date & Time' : 'End Time (opt)'}</Label>
          <Input type="datetime-local" value={form.endTime} onChange={(e: any) => setForm({ ...form, endTime: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        {/* Location */}
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">City</Label>
          <Input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} placeholder={parentStream?.city || 'e.g. Kampala'} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Country</Label>
          <Input value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} placeholder={parentStream?.country || 'e.g. Uganda'} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        {/* Access price — single only */}
        {!isCompetition && (
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Access Price (USD)</Label>
            <Input type="number" step="0.01" value={form.accessPrice} onChange={(e: any) => setForm({ ...form, accessPrice: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
          </div>
        )}

        {/* Thumbnail */}
        {onFileChange && fileInputRef && (
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Thumbnail</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs">
                <Upload className="h-3 w-3 mr-1" /> Upload
              </Button>
              {thumbnailPreview && onClearThumb && (
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

        {/* Description */}
        <div className="md:col-span-2 space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Description</Label>
          <Input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        {/* "Create betting game" toggle — single streams only */}
        {!isCompetition && setCreateGame !== undefined && (
          <div className="md:col-span-2 rounded border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 mt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setCreateGame(!createGame)}
                className={`relative w-8 h-4 rounded-full transition-colors ${createGame ? 'bg-amber-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${createGame ? 'translate-x-4' : ''}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-medium text-slate-300">Create betting game from this stream</span>
              </div>
            </label>
            {createGame && (
              <p className="text-[10px] text-amber-400/80 pl-10">A matching game entry will be created so users can place bets on this match.</p>
            )}
          </div>
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

/* ─── StreamCard ────────────────────────────────────────────────────── */
function StreamCard({
  stream, isChild = false, ctx,
}: { stream: any; isChild?: boolean; ctx: any }) {
  const {
    childrenByParent, expanded, toggleExpand,
    editId, startEdit, editForm, setEditForm, handleEdit, editSaving,
    setEditId, editThumbnailPreview, editFileInputRef, handleEditFileChange, clearEditThumbnail,
    goLiveId, setGoLiveId, hlsUrl, setHlsUrl, handleGoLive, handleEnd, handleDelete,
    addStreamParentId, setAddStreamParentId,
    childForm, setChildForm, childThumbnailFile, setChildThumbnailFile,
    childThumbnailPreview, setChildThumbnailPreview, childFileInputRef,
    handleAddStream, savingChild, childCreateGame, setChildCreateGame,
    token, isAdmin,
  } = ctx;

  const isCompetition = stream.type === 'competition';
  const children = childrenByParent[stream.id] || [];
  const isExpanded = expanded.has(stream.id);

  const handleChildFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChildThumbnailFile(file);
    setChildThumbnailPreview(URL.createObjectURL(file));
  };

  return (
    <div>
      <Card className={`bg-slate-900 border-slate-800 ${editId === stream.id ? 'border-amber-500/40' : ''} ${isChild ? 'bg-slate-950/60' : ''}`}>
        <CardContent className="py-2 px-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0 w-full">
            {/* Expand toggle for competitions */}
            {isCompetition && (
              <button onClick={() => toggleExpand(stream.id)} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-1 sm:mt-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {isChild && <Swords className="h-3 w-3 text-slate-600 flex-shrink-0 mt-1.5 sm:mt-0" />}

            {/* Thumbnail */}
            <div className="flex-shrink-0 w-16 h-10 rounded overflow-hidden bg-slate-800/50 flex items-center justify-center border border-slate-800">
              {stream.thumbnailUrl
                ? <img src={stream.thumbnailUrl} alt={stream.title} className="w-full h-full object-cover" />
                : <ImageIcon className="h-4 w-4 text-slate-600" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                {isCompetition && (
                  <span className="px-1.5 py-0 rounded border border-purple-500/30 bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase tracking-wider">Comp</span>
                )}
                {!isCompetition && (
                  <span className={`px-1.5 py-0 rounded-full border text-[9px] font-bold uppercase tracking-wider ${STATUS_COLORS[stream.status] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                    {stream.status}
                  </span>
                )}
                <span className="text-[10px] text-slate-500 capitalize">{stream.sport}</span>
              </div>
              <p className="text-white font-semibold text-sm sm:text-xs truncate">
                {isCompetition
                  ? stream.title
                  : stream.playerA ? <>{stream.playerA} <span className="text-slate-500 font-normal text-[10px]">vs</span> {stream.playerB}</> : stream.title}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span>{new Date(stream.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                {stream.endTime && <span>→ {new Date(stream.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>}
                {(stream.city || stream.country) && <span>· {[stream.city, stream.country].filter(Boolean).join(', ')}</span>}
                {isCompetition && children.length > 0 && <span>· {children.length} stream{children.length !== 1 ? 's' : ''}</span>}
                {!isCompetition && <span className="text-amber-400 font-mono font-bold">· ${stream.accessPrice}/d</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t border-slate-800 sm:border-0 pt-2 sm:pt-0 shrink-0">
            {/* Edit */}
            <Button size="sm" variant="ghost"
              onClick={() => editId === stream.id ? setEditId(null) : startEdit(stream)}
              className="h-7 w-7 p-0 text-slate-500 hover:text-amber-400 bg-slate-800/50 hover:bg-amber-500/10 rounded"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* Go Live — upcoming single streams */}
            {!isCompetition && stream.status === 'upcoming' && (
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

            {/* End — live single streams */}
            {!isCompetition && stream.status === 'live' && (
              <Button size="sm" variant="destructive" onClick={() => handleEnd(stream.id)} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider">
                <Square className="h-3 w-3 mr-1" /> End
              </Button>
            )}

            {/* Delete */}
            <Button size="sm" variant="ghost"
              onClick={() => handleDelete(stream.id, stream.title)}
              className="h-7 w-7 p-0 text-slate-600 hover:text-red-400 bg-slate-800/50 hover:bg-red-500/10 rounded"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      {editId === stream.id && (
        <div className="mt-2">
          <StreamForm
            form={editForm} setForm={setEditForm}
            isChild={isChild}
            thumbnailPreview={editThumbnailPreview}
            fileInputRef={editFileInputRef}
            onFileChange={handleEditFileChange}
            onClearThumb={clearEditThumbnail}
            onSave={handleEdit}
            onCancel={() => { setEditId(null); clearEditThumbnail(); }}
            saving={editSaving}
            title="Edit Stream"
            accentClass="border-amber-500/30"
          />
        </div>
      )}

      {/* Competition children */}
      {isCompetition && isExpanded && (
        <div className="ml-2 sm:ml-6 mt-2 space-y-2 border-l-2 border-slate-800 pl-2 sm:pl-4">
          {children.map((child: any) => (
            <StreamCard key={child.id} stream={child} isChild ctx={ctx} />
          ))}

          {addStreamParentId === stream.id ? (
            <div className="mt-2">
              <StreamForm
                form={childForm} setForm={setChildForm}
                isChild
                thumbnailPreview={childThumbnailPreview}
                fileInputRef={childFileInputRef}
                onFileChange={handleChildFileChange}
                onClearThumb={() => { setChildThumbnailFile(null); setChildThumbnailPreview(null); if (childFileInputRef.current) childFileInputRef.current.value = ''; }}
                createGame={childCreateGame} setCreateGame={isAdmin ? setChildCreateGame : undefined}
                onSave={() => handleAddStream(stream)}
                onCancel={() => { setAddStreamParentId(null); setChildForm({ ...EMPTY_SINGLE, type: 'single' }); setChildCreateGame(false); }}
                saving={savingChild}
                title={`Add Stream to "${stream.title}"`}
                accentClass="border-teal-500/30"
                parentStream={stream}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setAddStreamParentId(stream.id);
                setChildForm({ ...EMPTY_SINGLE, type: 'single', sport: stream.sport || 'pool', city: stream.city || '', country: stream.country || '' });
                setChildCreateGame(false);
              }}
              className="w-full py-1.5 px-3 rounded border border-dashed border-slate-700 bg-slate-900/50 text-slate-500 hover:text-teal-400 hover:border-teal-500/40 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3 w-3" /> Add Stream
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────── */
export default function AdminStreams() {
  useEffect(() => { document.title = 'Streams - Admin'; }, []);

  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const userRole = useAuthStore((s) => s.user?.role);
  const isAdmin = userRole === 'admin';

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<StreamFormData>({ ...EMPTY_SINGLE });
  const [createGame, setCreateGame] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<StreamFormData>({ ...EMPTY_SINGLE });
  const [editSaving, setEditSaving] = useState(false);
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const [editThumbnailPreview, setEditThumbnailPreview] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Child stream state
  const [addStreamParentId, setAddStreamParentId] = useState<number | null>(null);
  const [childForm, setChildForm] = useState<StreamFormData>({ ...EMPTY_SINGLE, type: 'single' });
  const [childCreateGame, setChildCreateGame] = useState(false);
  const [childThumbnailFile, setChildThumbnailFile] = useState<File | null>(null);
  const [childThumbnailPreview, setChildThumbnailPreview] = useState<string | null>(null);
  const childFileInputRef = useRef<HTMLInputElement>(null);
  const [savingChild, setSavingChild] = useState(false);

  // Go live state
  const [goLiveId, setGoLiveId] = useState<number | null>(null);
  const [hlsUrl, setHlsUrl] = useState('');

  // Expand state for competitions
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: streamsData, isLoading } = useQuery({
    queryKey: ['streams', 'all'],
    queryFn: () =>
      fetch('/api/streams?limit=200&include_all=true', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (r) => {
        if (!r.ok) throw new Error('Failed to load streams');
        return r.json() as Promise<{ streams: any[] }>;
      }),
  });

  const createStream = useCreateStream();
  const updateStream = useUpdateStream();
  const goLive = useGoLive();
  const endStream = useEndStream();
  const deleteStream = useDeleteStream();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['streams'] });

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* Thumbnail helpers */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setThumbnailFile(file); setThumbnailPreview(URL.createObjectURL(file));
  };
  const clearThumbnail = () => {
    setThumbnailFile(null); setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const uploadThumbnail = async (file: File | null): Promise<string | null> => {
    if (!file) return null;
    const fd = new FormData(); fd.append('thumbnail', file);
    const r = await fetch('/api/uploads/thumbnail', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
    return (await r.json()).url;
  };
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setEditThumbnailFile(file); setEditThumbnailPreview(URL.createObjectURL(file));
  };
  const clearEditThumbnail = () => {
    setEditThumbnailFile(null); setEditThumbnailPreview(null);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  /* Build betting game from stream form data */
  const postBettingGame = async (f: StreamFormData) => {
    const startParts = f.startTime.split('T');
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'single',
        sport: f.sport,
        playerA: f.playerA,
        playerB: f.playerB,
        playerACountry: f.playerACountry || undefined,
        playerBCountry: f.playerBCountry || undefined,
        eventDate: startParts[0],
        eventTime: startParts[1]?.slice(0, 5) || '18:00',
        eventEndDate: f.endTime ? f.endTime.split('T')[0] : undefined,
        eventEndTime: f.endTime ? f.endTime.split('T')[1]?.slice(0, 5) : undefined,
        city: f.city || undefined,
        country: f.country || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `Failed to create betting game (${res.status})`);
    }
  };

  /* Create top-level stream */
  const validateCreate = () => {
    if (!form.title.trim()) { toast.error('Please enter a title'); return false; }
    if (!form.startTime) { toast.error('Please set a start date and time'); return false; }
    if (form.type === 'single') {
      if (!form.playerA.trim()) { toast.error('Please enter Player A name'); return false; }
      if (!form.playerB.trim()) { toast.error('Please enter Player B name'); return false; }
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateCreate()) return;
    try {
      setUploading(true);
      const thumbnailUrl = await uploadThumbnail(thumbnailFile);
      await createStream.mutateAsync({
        data: {
          type: form.type,
          title: form.title,
          description: form.description || undefined,
          sport: form.sport,
          startTime: form.startTime,
          endTime: form.endTime || undefined,
          accessPrice: form.type === 'single' ? parseFloat(form.accessPrice) : 0,
          thumbnailUrl: thumbnailUrl ?? undefined,
          playerA: form.type === 'single' ? form.playerA : undefined,
          playerB: form.type === 'single' ? form.playerB : undefined,
          playerACountry: form.playerACountry || undefined,
          playerBCountry: form.playerBCountry || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
        } as any,
      });

      if (createGame && form.type === 'single') {
        await postBettingGame(form);
      }

      invalidate();
      toast.success(
        form.type === 'competition'
          ? 'Competition created — add individual streams to it below'
          : `Stream created${createGame ? ' + betting game created' : ''}`
      );
      setShowForm(false);
      setForm({ ...EMPTY_SINGLE, startTime: defaultStartTime() });
      setCreateGame(false);
      clearThumbnail();
    } catch (e: any) {
      toast.error(e?.message || e?.data?.error || 'Failed to create stream');
    } finally {
      setUploading(false);
    }
  };

  /* Add child stream to competition */
  const handleAddStream = async (parentStream: any) => {
    if (!childForm.playerA.trim()) { toast.error('Player A required'); return; }
    if (!childForm.playerB.trim()) { toast.error('Player B required'); return; }
    if (!childForm.startTime) { toast.error('Date & time required'); return; }
    try {
      setSavingChild(true);
      const thumbnailUrl = await uploadThumbnail(childThumbnailFile);
      const title = childForm.title.trim() || `${childForm.playerA} vs ${childForm.playerB}`;
      await createStream.mutateAsync({
        data: {
          type: 'single',
          parentId: parentStream.id,
          title,
          description: childForm.description || undefined,
          sport: childForm.sport || parentStream.sport,
          startTime: childForm.startTime,
          endTime: childForm.endTime || undefined,
          accessPrice: parseFloat(childForm.accessPrice) || 1.50,
          thumbnailUrl: thumbnailUrl ?? undefined,
          playerA: childForm.playerA,
          playerB: childForm.playerB,
          playerACountry: childForm.playerACountry || undefined,
          playerBCountry: childForm.playerBCountry || undefined,
          city: childForm.city || parentStream.city || undefined,
          country: childForm.country || parentStream.country || undefined,
        } as any,
      });

      if (childCreateGame) {
        await postBettingGame(childForm);
      }

      invalidate();
      toast.success(`Stream added to "${parentStream.title}"${childCreateGame ? ' + betting game created' : ''}`);
      setAddStreamParentId(null);
      setChildForm({ ...EMPTY_SINGLE, type: 'single' });
      setChildCreateGame(false);
      setChildThumbnailFile(null);
      setChildThumbnailPreview(null);
      setExpanded((prev) => new Set([...prev, parentStream.id]));
    } catch (e: any) {
      toast.error(e?.message || e?.data?.error || 'Failed to add stream');
    } finally {
      setSavingChild(false);
    }
  };

  /* Edit */
  const startEdit = (stream: any) => {
    setEditId(stream.id);
    setEditForm({
      type: stream.type || 'single',
      title: stream.title || '',
      description: stream.description || '',
      sport: stream.sport || 'pool',
      startTime: toLocalDatetime(stream.startTime),
      endTime: toLocalDatetime(stream.endTime),
      accessPrice: String(stream.accessPrice ?? '1.50'),
      playerA: stream.playerA || '',
      playerB: stream.playerB || '',
      playerACountry: stream.playerACountry || '',
      playerBCountry: stream.playerBCountry || '',
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
      const newThumbnailUrl = await uploadThumbnail(editThumbnailFile);
      await updateStream.mutateAsync({
        id: editId!,
        data: {
          title: editForm.title,
          description: editForm.description || undefined,
          sport: editForm.sport,
          startTime: editForm.startTime,
          endTime: editForm.endTime || undefined,
          accessPrice: parseFloat(editForm.accessPrice) || 1.50,
          city: editForm.city || undefined,
          country: editForm.country || undefined,
          playerA: editForm.playerA || undefined,
          playerB: editForm.playerB || undefined,
          playerACountry: editForm.playerACountry || undefined,
          playerBCountry: editForm.playerBCountry || undefined,
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
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const handleEnd = async (id: number) => {
    try {
      await endStream.mutateAsync({ id });
      invalidate();
      toast.success('Stream ended');
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteStream.mutateAsync({ id });
      invalidate();
      toast.success('Stream deleted');
    } catch (e: any) { toast.error(e?.data?.error || 'Failed to delete'); }
  };

  /* Build data structures */
  const allStreams: any[] = streamsData?.streams || [];
  const topLevel = allStreams.filter((s) => !s.parentId);
  const childrenByParent: Record<number, any[]> = {};
  for (const s of allStreams) {
    if (s.parentId) {
      childrenByParent[s.parentId] = [...(childrenByParent[s.parentId] || []), s];
    }
  }
  const activeTopLevel = topLevel.filter((s) => s.status !== 'ended' || s.type === 'competition');
  const pastTopLevel = topLevel.filter((s) => s.status === 'ended' && s.type !== 'competition');

  const ctx = {
    childrenByParent, expanded, toggleExpand,
    editId, startEdit, editForm, setEditForm, handleEdit, editSaving,
    setEditId, editThumbnailPreview, editFileInputRef, handleEditFileChange, clearEditThumbnail,
    goLiveId, setGoLiveId, hlsUrl, setHlsUrl, handleGoLive, handleEnd, handleDelete,
    addStreamParentId, setAddStreamParentId,
    childForm, setChildForm, childThumbnailFile, setChildThumbnailFile,
    childThumbnailPreview, setChildThumbnailPreview, childFileInputRef,
    handleAddStream, savingChild, childCreateGame, setChildCreateGame,
    token, isAdmin,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radio className="h-6 w-6 text-teal-400" /> Streams
        </h1>
        <Button
          onClick={() => { setShowForm(!showForm); setEditId(null); setAddStreamParentId(null); }}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950"
        >
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {showForm && (
        <StreamForm
          form={form} setForm={setForm}
          thumbnailPreview={thumbnailPreview}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onClearThumb={clearThumbnail}
          createGame={createGame} setCreateGame={isAdmin ? setCreateGame : undefined}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); clearThumbnail(); setForm({ ...EMPTY_SINGLE, startTime: defaultStartTime() }); setCreateGame(false); }}
          saving={createStream.isPending || uploading}
          title="Create Stream"
          accentClass="border-teal-500/30"
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {activeTopLevel.map((stream) => (
              <StreamCard key={stream.id} stream={stream} ctx={ctx} />
            ))}
            {activeTopLevel.length === 0 && (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No active streams yet. Create a single stream or a competition above.
              </div>
            )}
          </div>

          {pastTopLevel.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-slate-800" />
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-widest">
                  <Archive className="h-3.5 w-3.5" /> Past Streams ({pastTopLevel.length})
                </div>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              {pastTopLevel.map((stream) => (
                <StreamCard key={stream.id} stream={stream} ctx={ctx} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
