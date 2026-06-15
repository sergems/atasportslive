import React, { useEffect, useState } from 'react';
import { useListGames, useCreateGame, useUpdateGame, useSettleGame, useCancelGame } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Plus, CheckCircle, XCircle, Pencil, ChevronDown, ChevronRight, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListGamesQueryKey } from '@workspace/api-client-react';

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
}: {
  form: GameFormData; setForm: (f: GameFormData) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; title: string; accentClass: string;
  isChild?: boolean; parentGame?: any;
}) {
  const isCompetition = form.type === 'competition';

  return (
    <Card className={`bg-slate-900 border ${accentClass}`}>
      <CardHeader>
        <CardTitle className="text-white text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!isChild && (
          <div className="md:col-span-2 space-y-2">
            <Label className="text-slate-300">Type</Label>
            <div className="flex gap-3">
              {(['single', 'competition'] as GameType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors capitalize
                    ${form.type === t
                      ? t === 'competition'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                >
                  {t === 'single' ? '⚔️ Single Match' : '🏆 Competition'}
                </button>
              ))}
            </div>
            {isCompetition && (
              <p className="text-xs text-slate-500">
                A competition spans multiple dates and can have individual matches added under it.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-slate-300">Sport <span className="text-red-400">*</span></Label>
          <select
            value={form.sport}
            onChange={(e: any) => setForm({ ...form, sport: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm capitalize"
          >
            {SPORTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        {isCompetition ? (
          <div className="space-y-1">
            <Label className="text-slate-300">Competition Name <span className="text-red-400">*</span></Label>
            <Input
              value={form.playerA}
              onChange={(e: any) => setForm({ ...form, playerA: e.target.value })}
              placeholder="e.g. Kampala Pool Open 2026"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-slate-300">Player A <span className="text-red-400">*</span></Label>
              <Input value={form.playerA} onChange={(e: any) => setForm({ ...form, playerA: e.target.value })} placeholder="e.g. John Doe" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Player A Country <span className="text-slate-500 font-normal text-xs">(2-letter ISO, e.g. UG)</span></Label>
              <Input value={form.playerACountry} onChange={(e: any) => setForm({ ...form, playerACountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="UG" maxLength={2} className="bg-slate-800 border-slate-700 text-white uppercase" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Player B <span className="text-red-400">*</span></Label>
              <Input value={form.playerB} onChange={(e: any) => setForm({ ...form, playerB: e.target.value })} placeholder="e.g. Jane Doe" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Player B Country <span className="text-slate-500 font-normal text-xs">(2-letter ISO, e.g. KE)</span></Label>
              <Input value={form.playerBCountry} onChange={(e: any) => setForm({ ...form, playerBCountry: e.target.value.toUpperCase().slice(0, 2) })} placeholder="KE" maxLength={2} className="bg-slate-800 border-slate-700 text-white uppercase" />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-slate-300">{isCompetition ? 'Start Date' : 'Date'} <span className="text-red-400">*</span></Label>
          <Input type="date" value={form.eventDate} onChange={(e: any) => setForm({ ...form, eventDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">{isCompetition ? 'Start Time' : 'Time'} <span className="text-red-400">*</span></Label>
          <Input type="time" value={form.eventTime} onChange={(e: any) => setForm({ ...form, eventTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>

        <div className="space-y-1">
          <Label className="text-slate-300">{isCompetition ? 'End Date' : 'End Date (optional)'}</Label>
          <Input type="date" value={form.eventEndDate} onChange={(e: any) => setForm({ ...form, eventEndDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">{isCompetition ? 'End Time' : 'End Time (optional)'}</Label>
          <Input type="time" value={form.eventEndTime} onChange={(e: any) => setForm({ ...form, eventEndTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>

        <div className="space-y-1">
          <Label className="text-slate-300">City</Label>
          <Input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} placeholder={parentGame?.city || 'e.g. Kampala'} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Country</Label>
          <Input value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} placeholder={parentGame?.country || 'e.g. Uganda'} className="bg-slate-800 border-slate-700 text-white" />
        </div>

        <div className="md:col-span-2 flex gap-3">
          <Button onClick={onSave} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-slate-950">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400">Cancel</Button>
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
      await settleGame.mutateAsync({ id: game.id, data: { result } });
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
      <Card className={`bg-slate-900 border-primary/20 ${editId === game.id ? 'border-amber-500/40' : ''} ${isChild ? 'bg-slate-950/60' : ''}`}>
        <CardContent className="py-3 px-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isCompetition && (
              <button onClick={() => toggleExpand(game.id)} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
            {isChild && <Swords className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {isCompetition && (
                  <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs">Competition</Badge>
                )}
                <Badge className={`${STATUS_COLORS[game.status]} border text-xs`}>{game.status}</Badge>
                <span className="text-xs text-slate-500 capitalize">{game.sport}</span>
                {!isCompetition && (
                  <span className="text-xs text-slate-600">{game.openBetsCount} open · {game.matchedBetsCount} matched</span>
                )}
              </div>
              <p className="text-white font-semibold text-sm">
                {isCompetition
                  ? game.playerA
                  : <>{game.playerA} <span className="text-slate-500 font-normal text-xs">vs</span> {game.playerB}</>}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatDateRange(game)}
                {(game.city || game.country) ? ` · ${[game.city, game.country].filter(Boolean).join(', ')}` : ''}
                {isCompetition && children.length > 0 ? ` · ${children.length} match${children.length !== 1 ? 'es' : ''}` : ''}
                {!isCompetition ? ` · Pool: $${(game.totalBetPool || 0).toFixed(2)}` : ''}
              </p>
              {game.result && <p className="text-xs text-teal-400 mt-0.5">Result: {game.result.replace(/_/g, ' ')}</p>}
            </div>
          </div>

          <div className="flex gap-1.5 flex-shrink-0 items-center flex-wrap justify-end">
            <Button
              size="sm" variant="ghost"
              onClick={() => editId === game.id ? setEditId(null) : startEdit(game)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {['upcoming', 'live'].includes(game.status) && (
              settleId === game.id
                ? <SettlePanel game={game} onDone={() => setSettleId(null)} />
                : (
                  <Button size="sm" onClick={() => setSettleId(game.id)} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 h-7 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Settle
                  </Button>
                )
            )}

            {['upcoming', 'live'].includes(game.status) && (
              <Button size="sm" variant="destructive" onClick={() => handleCancel(game.id)} className="h-7 text-xs">
                <XCircle className="h-3 w-3 mr-1" /> Cancel
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
        <div className="ml-6 mt-2 space-y-2 border-l-2 border-slate-800 pl-4">
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
              className="w-full py-2 px-4 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:text-teal-400 hover:border-teal-500/40 text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add Match
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminGames() {
  useEffect(() => { document.title = 'Manage Games - Admin'; }, []);

  const qc = useQueryClient();
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

  const { data: gamesData, isLoading } = useListGames({ limit: 100 });
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const cancelGame = useCancelGame();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListGamesQueryKey() });

  const allGames: any[] = gamesData?.games || [];
  const topLevel = allGames.filter((g) => !g.parentId);
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
      invalidate();
      toast.success(form.type === 'competition' ? 'Competition created — add individual matches below it' : 'Game created');
      setShowForm(false);
      setForm({ ...EMPTY_SINGLE });
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
          <Trophy className="h-6 w-6 text-amber-400" /> Manage Games
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
          onCancel={() => { setShowForm(false); setForm({ ...EMPTY_SINGLE }); }}
          saving={createGame.isPending} title="Create Game / Competition" accentClass="border-amber-500/30"
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map((game) => <GameCard key={game.id} game={game} ctx={ctx} />)}
          {topLevel.length === 0 && (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No games yet. Create a single match or a competition above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
