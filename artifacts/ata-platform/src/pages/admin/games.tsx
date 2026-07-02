import React, { useEffect, useState } from 'react';
import { useListGames, useCreateGame, useUpdateGame, useSettleGame, useCancelGame } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Plus, CheckCircle, XCircle, Pencil, ChevronDown, ChevronRight, Swords, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListGamesQueryKey } from '@workspace/api-client-react';
import { useAuthStore } from '@/lib/auth-store';

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  live: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const SPORTS = ['pool', 'boxing', 'football', 'athletics', 'basketball'];

type GameType = 'single' | 'competition';

interface GameFormData {
  type: GameType;
  sport: string;
  playerA: string;
  playerACountry: string;
  playerB: string;
  playerBCountry: string;
  eventDate: string;
  eventTime: string;
  eventEndDate: string;
  eventEndTime: string;
  city: string;
  country: string;
}

const EMPTY_SINGLE: GameFormData = {
  type: 'single', sport: 'pool',
  playerA: '', playerACountry: '',
  playerB: '', playerBCountry: '',
  eventDate: '', eventTime: '',
  eventEndDate: '', eventEndTime: '',
  city: '', country: '',
};

const EMPTY_COMPETITION: GameFormData = {
  type: 'competition', sport: 'pool',
  playerA: '', playerACountry: '',
  playerB: '', playerBCountry: '',
  eventDate: '', eventTime: '',
  eventEndDate: '', eventEndTime: '',
  city: '', country: '',
};

function GameForm({
  form, setForm, onSave, onCancel, saving, title, accentClass,
  isChild = false, parentGame,
  createStream, setCreateStream, streamPrice, setStreamPrice,
}: {
  form: GameFormData; setForm: (f: GameFormData) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; title: string; accentClass: string;
  isChild?: boolean; parentGame?: any;
  createStream?: boolean; setCreateStream?: (v: boolean) => void;
  streamPrice?: string; setStreamPrice?: (v: string) => void;
}) {
  const isCompetition = form.type === 'competition';

  return (
    <Card className={`bg-slate-900 border ${accentClass}`}>
      <CardHeader className="py-2 px-3 border-b border-slate-800">
        <CardTitle className="text-white text-xs uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {!isChild && (
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs text-slate-400">Type</Label>
            <div className="flex gap-2">
              {(['single', 'competition'] as GameType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-1.5 px-3 rounded border text-[10px] font-bold uppercase tracking-wider transition-colors
                    ${form.type === t
                      ? t === 'competition'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                  {t === 'single' ? 'Single Match' : 'Competition'}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {isCompetition ? (
          <div className="space-y-1">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Competition Name <span className="text-red-400">*</span></Label>
            <Input
              value={form.playerA}
              onChange={(e: any) => setForm({ ...form, playerA: e.target.value })}
              placeholder="e.g. Kampala Pool Open 2026"
              className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player A <span className="text-red-400">*</span></Label>
              <Input value={form.playerA} onChange={(e: any) => setForm({ ...form, playerA: e.target.value })} placeholder="e.g. John Doe" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player A Country <span className="text-slate-500 font-normal lowercase">(2-letter ISO)</span></Label>
              <Input value={form.playerACountry} onChange={(e: any) => setForm({ ...form, playerACountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UG" maxLength={2} className="bg-slate-950 border-slate-800 text-white h-8 text-xs uppercase focus-visible:ring-1 focus-visible:ring-teal-500/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player B <span className="text-red-400">*</span></Label>
              <Input value={form.playerB} onChange={(e: any) => setForm({ ...form, playerB: e.target.value })} placeholder="e.g. Jane Doe" className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Player B Country <span className="text-slate-500 font-normal lowercase">(2-letter ISO)</span></Label>
              <Input value={form.playerBCountry} onChange={(e: any) => setForm({ ...form, playerBCountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="KE" maxLength={2} className="bg-slate-950 border-slate-800 text-white h-8 text-xs uppercase focus-visible:ring-1 focus-visible:ring-teal-500/50" />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isCompetition ? 'Start Date' : 'Date'} <span className="text-red-400">*</span></Label>
          <Input type="date" value={form.eventDate} onChange={(e: any) => setForm({ ...form, eventDate: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isCompetition ? 'Start Time' : 'Time'} <span className="text-red-400">*</span></Label>
          <Input type="time" value={form.eventTime} onChange={(e: any) => setForm({ ...form, eventTime: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isCompetition ? 'End Date' : 'End Date (opt)'}</Label>
          <Input type="date" value={form.eventEndDate} onChange={(e: any) => setForm({ ...form, eventEndDate: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">{isCompetition ? 'End Time' : 'End Time (opt)'}</Label>
          <Input type="time" value={form.eventEndTime} onChange={(e: any) => setForm({ ...form, eventEndTime: e.target.value })} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">City</Label>
          <Input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} placeholder={parentGame?.city || 'e.g. Kampala'} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wider">Country</Label>
          <Input value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} placeholder={parentGame?.country || 'e.g. Uganda'} className="bg-slate-950 border-slate-800 text-white h-8 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50" />
        </div>

        {/* Stream toggle */}
        {!isChild && !isCompetition && setCreateStream && setStreamPrice && (
          <div className="md:col-span-2 rounded border border-teal-500/20 bg-teal-500/5 p-3 space-y-2 mt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setCreateStream(!createStream)}
                className={`relative w-8 h-4 rounded-full transition-colors ${createStream ? 'bg-teal-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${createStream ? 'translate-x-4' : ''}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-teal-400" />
                <span className="text-xs font-medium text-slate-300">Create stream</span>
              </div>
            </label>
            {createStream && (
              <div className="space-y-1 pl-10">
                <Label className="text-slate-400 text-[10px] uppercase tracking-wider">Access price (USD)</Label>
                <Input
                  type="number" step="0.01" value={streamPrice}
                  onChange={(e: any) => setStreamPrice(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white w-24 h-7 text-xs focus-visible:ring-1 focus-visible:ring-teal-500/50"
                />
              </div>
            )}
          </div>
        )}

        <div className="md:col-span-2 flex gap-2 mt-2">
          <Button size="sm" onClick={onSave} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-slate-950 h-8 px-4 text-xs font-bold">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 px-3 text-xs">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettlePanel({ game, onDone }: { game: any; onDone: () => void }) {
  const [result, setResult] = useState('player_a_wins');
  const settleGame = useSettleGame();
  const qc = useQueryClient();

  const handle = async () => {
    try {
      await settleGame.mutateAsync({ id: game.id, data: { result: result as any } });
      qc.invalidateQueries({ queryKey: getListGamesQueryKey() });
      toast.success('Game settled');
      onDone();
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const isCompetition = game.type === 'competition';

  return (
    <div className="flex gap-2 items-center">
      {isCompetition ? (
        <select value={result} onChange={(e) => setResult(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-xs">
          <option value="player_a_wins">Winner Set</option>
          <option value="draw">No Winner / Draw</option>
        </select>
      ) : (
        <select value={result} onChange={(e) => setResult(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-xs">
          <option value="player_a_wins">{game.playerA} Wins</option>
          <option value="player_b_wins">{game.playerB} Wins</option>
          <option value="draw">Draw</option>
        </select>
      )}
      <Button size="sm" onClick={handle} disabled={settleGame.isPending} className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-7 text-xs">Settle</Button>
      <Button size="sm" variant="ghost" onClick={onDone} className="text-slate-400 h-7 text-xs">✕</Button>
    </div>
  );
}

interface GameCardCtx {
  childrenByParent: Record<number, any[]>;
  expanded: Set<number>;
  toggleExpand: (id: number) => void;
  editId: number | null;
  setEditId: (id: number | null) => void;
  editForm: GameFormData;
  setEditForm: (f: GameFormData) => void;
  handleEdit: () => void;
  savingEdit: boolean;
  settleId: number | null;
  setSettleId: (id: number | null) => void;
  addMatchParentId: number | null;
  setAddMatchParentId: (id: number | null) => void;
  childForm: GameFormData;
  setChildForm: (f: GameFormData) => void;
  handleAddMatch: (parentGame: any) => Promise<void>;
  savingChild: boolean;
  handleCancel: (id: number) => Promise<void>;
  startEdit: (game: any) => void;
  formatDateRange: (game: any) => string;
}

function GameCard({ game, isChild = false, ctx }: { game: any; isChild?: boolean; ctx: GameCardCtx }) {
  const {
    childrenByParent, expanded, toggleExpand,
    editId, setEditId, editForm, setEditForm, handleEdit, savingEdit,
    settleId, setSettleId,
    addMatchParentId, setAddMatchParentId, childForm, setChildForm, handleAddMatch, savingChild,
    handleCancel, startEdit, formatDateRange,
  } = ctx;

  const isCompetition = game.type === 'competition';
  const children = childrenByParent[game.id] || [];
  const isExpanded = expanded.has(game.id);

  return (
    <div>
      <Card className={`bg-slate-900 border-slate-800 ${editId === game.id ? 'border-amber-500/40' : ''} ${isChild ? 'bg-slate-950/60' : ''}`}>
        <CardContent className="py-2 px-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0 w-full">
            {isCompetition && (
              <button onClick={() => toggleExpand(game.id)} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-1 sm:mt-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {isChild && <Swords className="h-3 w-3 text-slate-600 flex-shrink-0 mt-1.5 sm:mt-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                {isCompetition && (
                  <span className="px-1.5 py-0 rounded border border-purple-500/30 bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase tracking-wider">Comp</span>
                )}
                <span className={`px-1.5 py-0 rounded border text-[9px] font-bold uppercase tracking-wider ${STATUS_COLORS[game.status]}`}>{game.status}</span>
                <span className="text-[10px] text-slate-500 capitalize">{game.sport}</span>
                {!isCompetition && (
                  <span className="text-[10px] text-slate-600 font-mono">B:{game.openBetsCount} M:{game.matchedBetsCount}</span>
                )}
              </div>
              <p className="text-white font-semibold text-sm sm:text-xs truncate">
                {isCompetition
                  ? game.playerA
                  : <>{game.playerA} <span className="text-slate-500 font-normal text-[10px]">vs</span> {game.playerB}</>}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                <span>{formatDateRange(game)}</span>
                {(game.city || game.country) && <span>· {[game.city, game.country].filter(Boolean).join(', ')}</span>}
                {isCompetition && children.length > 0 && <span>· {children.length} match{children.length !== 1 ? 'es' : ''}</span>}
                {!isCompetition && <span className="text-teal-400 font-mono font-bold">· P:${(game.totalBetPool || 0).toFixed(2)}</span>}
              </div>
              {game.result && <p className="text-[10px] text-teal-400 mt-0.5 font-bold uppercase tracking-wider">Result: {game.result.replace(/_/g, ' ')}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end sm:justify-end border-t border-slate-800 sm:border-0 pt-2 sm:pt-0 shrink-0">
            <Button
              size="sm" variant="ghost"
              onClick={() => editId === game.id ? setEditId(null) : startEdit(game)}
              className="h-7 w-7 p-0 text-slate-500 hover:text-amber-400 bg-slate-800/50 hover:bg-amber-500/10 rounded"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {['upcoming', 'live'].includes(game.status) && (
              settleId === game.id
                ? <SettlePanel game={game} onDone={() => setSettleId(null)} />
                : (
                  <Button size="sm" onClick={() => setSettleId(game.id)} className="bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border border-teal-500/30 h-7 px-2 text-[10px] font-bold uppercase tracking-wider">
                    <CheckCircle className="h-3 w-3 mr-1" /> Settle
                  </Button>
                )
            )}

            {['upcoming', 'live'].includes(game.status) && (
              <Button size="sm" variant="ghost" onClick={() => handleCancel(game.id)} className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 bg-slate-800/50 hover:bg-red-500/10 rounded" title="Cancel Game">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      {editId === game.id && (
        <div className="mt-2">
          <GameForm
            form={editForm} setForm={setEditForm}
            onSave={handleEdit} onCancel={() => setEditId(null)}
            saving={savingEdit} title="Edit" accentClass="border-amber-500/30"
            isChild={isChild}
          />
        </div>
      )}

      {/* Competition children */}
      {isCompetition && isExpanded && (
        <div className="ml-2 sm:ml-6 mt-2 space-y-2 border-l-2 border-slate-800 pl-2 sm:pl-4">
          {children.map((child) => (
            <GameCard key={child.id} game={child} isChild ctx={ctx} />
          ))}

          {addMatchParentId === game.id ? (
            <div className="mt-2">
              <GameForm
                form={childForm} setForm={setChildForm}
                onSave={() => handleAddMatch(game)}
                onCancel={() => { setAddMatchParentId(null); setChildForm({ ...EMPTY_SINGLE }); }}
                saving={savingChild} title={`Add Match to "${game.playerA}"`}
                accentClass="border-teal-500/30" isChild parentGame={game}
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setAddMatchParentId(game.id);
                setChildForm({ ...EMPTY_SINGLE, sport: game.sport, city: game.city || '', country: game.country || '' });
              }}
              className="w-full py-1.5 px-3 rounded border border-dashed border-slate-700 bg-slate-900/50 text-slate-500 hover:text-teal-400 hover:border-teal-500/40 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3 w-3" /> Add Match
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PastGamesSection({ pastTopLevel, ctx }: { pastTopLevel: any[]; ctx: any }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? pastTopLevel : pastTopLevel.slice(0, 1);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pt-2 pb-1">
        <div className="h-px flex-1 bg-slate-800" />
        <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
          Past / Completed ({pastTopLevel.length})
        </div>
        <div className="h-px flex-1 bg-slate-800" />
      </div>
      <div className="space-y-2">
        {shown.map((game: any) => <GameCard key={game.id} game={game} ctx={ctx} />)}
      </div>
      {pastTopLevel.length > 1 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-teal-400 transition-colors py-1.5 border border-dashed border-slate-800 rounded bg-slate-900 hover:bg-slate-800/50 hover:border-teal-500/30"
        >
          {expanded
            ? '▲ Show less'
            : `▼ View all ${pastTopLevel.length} past / completed`}
        </button>
      )}
    </div>
  );
}

export default function AdminGames() {
  useEffect(() => { document.title = 'Manage Bets - Admin'; }, []);

  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [settleId, setSettleId] = useState<number | null>(null);
  const [addMatchParentId, setAddMatchParentId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<GameFormData>({ ...EMPTY_SINGLE });
  const [editForm, setEditForm] = useState<GameFormData>({ ...EMPTY_SINGLE });
  const [childForm, setChildForm] = useState<GameFormData>({ ...EMPTY_SINGLE });
  const [savingChild, setSavingChild] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createStream, setCreateStream] = useState(false);
  const [streamPrice, setStreamPrice] = useState('1.50');

  const { data: gamesData, isLoading } = useListGames({ limit: 100 });
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const cancelGame = useCancelGame();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListGamesQueryKey() });

  const allGames: any[] = gamesData?.games || [];
  const topLevel = allGames.filter((g) => !g.parentId);
  const activeTopLevel = topLevel.filter((g) => !['completed', 'cancelled'].includes(g.status));
  const pastTopLevel = topLevel.filter((g) => ['completed', 'cancelled'].includes(g.status));
  const childrenByParent: Record<number, any[]> = {};
  for (const g of allGames) {
    if (g.parentId) {
      childrenByParent[g.parentId] = [...(childrenByParent[g.parentId] || []), g];
    }
  }

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const validateGame = (f: GameFormData, isChild = false) => {
    if (!f.playerA.trim()) { toast.error(f.type === 'competition' ? 'Competition name required' : 'Player A required'); return false; }
    if (f.type === 'single' && !isChild && !f.playerB.trim()) { toast.error('Player B required'); return false; }
    if (isChild && !f.playerB.trim()) { toast.error('Player B required'); return false; }
    if (!f.eventDate) { toast.error('Date required'); return false; }
    if (!f.eventTime) { toast.error('Time required'); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!validateGame(form)) return;
    try {
      await createGame.mutateAsync({
        data: {
          type: form.type,
          sport: form.sport,
          playerA: form.playerA,
          playerB: form.type === 'competition' ? '' : form.playerB,
          playerACountry: form.playerACountry || undefined,
          playerBCountry: form.playerBCountry || undefined,
          eventDate: form.eventDate,
          eventTime: form.eventTime,
          eventEndDate: form.eventEndDate || undefined,
          eventEndTime: form.eventEndTime || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
        } as any,
      });

      if (createStream && form.type === 'single') {
        const startTime = `${form.eventDate}T${form.eventTime}`;
        const endTime = form.eventEndDate ? `${form.eventEndDate}T${form.eventEndTime || '23:59'}` : undefined;
        await fetch('/api/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: `${form.playerA} VS ${form.playerB}`,
            sport: form.sport,
            startTime,
            endTime,
            accessPrice: parseFloat(streamPrice) || 1.50,
            city: form.city || undefined,
            country: form.country || undefined,
          }),
        });
      }

      invalidate();
      const streamNote = createStream && form.type === 'single' ? ' + stream created' : '';
      toast.success(form.type === 'competition' ? 'Competition created — add individual matches below it' : `Game created${streamNote}`);
      setShowForm(false);
      setForm({ ...EMPTY_SINGLE });
      setCreateStream(false);
      setStreamPrice('1.50');
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const handleAddMatch = async (parentGame: any) => {
    if (!validateGame(childForm, true)) return;
    try {
      setSavingChild(true);
      await createGame.mutateAsync({
        data: {
          type: 'single',
          parentId: parentGame.id,
          sport: childForm.sport || parentGame.sport,
          playerA: childForm.playerA,
          playerB: childForm.playerB,
          playerACountry: childForm.playerACountry || undefined,
          playerBCountry: childForm.playerBCountry || undefined,
          eventDate: childForm.eventDate || parentGame.eventDate,
          eventTime: childForm.eventTime,
          eventEndDate: childForm.eventEndDate || undefined,
          eventEndTime: childForm.eventEndTime || undefined,
          city: childForm.city || parentGame.city || undefined,
          country: childForm.country || parentGame.country || undefined,
        } as any,
      });
      invalidate();
      toast.success('Match added — a stream was also created automatically');
      setAddMatchParentId(null);
      setChildForm({ ...EMPTY_SINGLE });
      setExpanded((prev) => new Set([...prev, parentGame.id]));
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
    finally { setSavingChild(false); }
  };

  const startEdit = (game: any) => {
    setEditId(game.id);
    setEditForm({
      type: game.type || 'single',
      sport: game.sport || 'pool',
      playerA: game.playerA || '',
      playerACountry: game.playerACountry || '',
      playerB: game.playerB || '',
      playerBCountry: game.playerBCountry || '',
      eventDate: game.eventDate || '',
      eventTime: game.eventTime || '',
      eventEndDate: game.eventEndDate || '',
      eventEndTime: game.eventEndTime || '',
      city: game.city || '',
      country: game.country || '',
    });
    setShowForm(false);
  };

  const handleEdit = async () => {
    if (!validateGame(editForm)) return;
    try {
      setSavingEdit(true);
      await updateGame.mutateAsync({
        id: editId!,
        data: {
          type: editForm.type,
          sport: editForm.sport,
          playerA: editForm.playerA,
          playerB: editForm.type === 'competition' ? '' : editForm.playerB,
          playerACountry: editForm.playerACountry || undefined,
          playerBCountry: editForm.playerBCountry || undefined,
          eventDate: editForm.eventDate,
          eventTime: editForm.eventTime,
          eventEndDate: editForm.eventEndDate || undefined,
          eventEndTime: editForm.eventEndTime || undefined,
          city: editForm.city || undefined,
          country: editForm.country || undefined,
        } as any,
      });
      invalidate();
      toast.success('Updated');
      setEditId(null);
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
    finally { setSavingEdit(false); }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelGame.mutateAsync({ id });
      invalidate();
      toast.success('Cancelled and stakes refunded');
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const formatDateRange = (game: any) => {
    let s = `${game.eventDate} ${game.eventTime}`;
    if (game.eventEndDate) s += ` → ${game.eventEndDate}${game.eventEndTime ? ' ' + game.eventEndTime : ''}`;
    return s;
  };

  const ctx: GameCardCtx = {
    childrenByParent, expanded, toggleExpand,
    editId, setEditId, editForm, setEditForm, handleEdit, savingEdit,
    settleId, setSettleId,
    addMatchParentId, setAddMatchParentId, childForm, setChildForm, handleAddMatch, savingChild,
    handleCancel, startEdit, formatDateRange,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" /> Manage Bets
        </h1>
        <Button
          onClick={() => { setShowForm(!showForm); setEditId(null); setAddMatchParentId(null); }}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950"
        >
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {showForm && (
        <GameForm
          form={form} setForm={setForm}
          onSave={handleCreate}
          onCancel={() => { setShowForm(false); setForm({ ...EMPTY_SINGLE }); setCreateStream(false); setStreamPrice('1.50'); }}
          saving={createGame.isPending} title="Create Game / Competition" accentClass="border-amber-500/30"
          createStream={createStream} setCreateStream={setCreateStream}
          streamPrice={streamPrice} setStreamPrice={setStreamPrice}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {activeTopLevel.map((game) => <GameCard key={game.id} game={game} ctx={ctx} />)}
            {activeTopLevel.length === 0 && (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No active games yet. Create a single match or a competition above.
              </div>
            )}
          </div>

          {pastTopLevel.length > 0 && (
            <PastGamesSection pastTopLevel={pastTopLevel} ctx={ctx} />
          )}
        </>
      )}
    </div>
  );
}
