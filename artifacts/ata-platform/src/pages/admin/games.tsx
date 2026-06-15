import React, { useEffect, useState } from 'react';
import { useListGames, useCreateGame, useUpdateGame, useSettleGame, useCancelGame } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Plus, CheckCircle, XCircle, Pencil } from 'lucide-react';
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

const EMPTY_FORM = { sport: 'pool', playerA: '', playerB: '', eventDate: '', eventTime: '', eventEndDate: '', eventEndTime: '', city: '', country: '' };

function GameForm({ form, setForm, onSave, onCancel, saving, title, accentClass }: any) {
  return (
    <Card className={`bg-slate-900 border ${accentClass}`}>
      <CardHeader><CardTitle className="text-white">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-slate-300">Sport</Label>
          <select value={form.sport} onChange={(e: any) => setForm({ ...form, sport: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm capitalize">
            {SPORTS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Player A</Label>
          <Input value={form.playerA} onChange={(e: any) => setForm({ ...form, playerA: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Player B</Label>
          <Input value={form.playerB} onChange={(e: any) => setForm({ ...form, playerB: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Start Date</Label>
          <Input type="date" value={form.eventDate} onChange={(e: any) => setForm({ ...form, eventDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Start Time</Label>
          <Input type="time" value={form.eventTime} onChange={(e: any) => setForm({ ...form, eventTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">End Date (optional)</Label>
          <Input type="date" value={form.eventEndDate} onChange={(e: any) => setForm({ ...form, eventEndDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">End Time (optional)</Label>
          <Input type="time" value={form.eventEndTime} onChange={(e: any) => setForm({ ...form, eventEndTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">City</Label>
          <Input value={form.city} onChange={(e: any) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Kampala" className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Country</Label>
          <Input value={form.country} onChange={(e: any) => setForm({ ...form, country: e.target.value })} placeholder="e.g. Uganda" className="bg-slate-800 border-slate-700 text-white" />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <Button onClick={onSave} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-slate-950">{saving ? 'Saving...' : 'Save'}</Button>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminGames() {
  useEffect(() => { document.title = 'Manage Games - Admin'; }, []);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [settleId, setSettleId] = useState<number | null>(null);
  const [settleResult, setSettleResult] = useState('player_a_wins');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const { data: gamesData, isLoading } = useListGames({ limit: 50 });
  const createGame = useCreateGame();
  const updateGame = useUpdateGame();
  const settleGame = useSettleGame();
  const cancelGame = useCancelGame();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });

  const handleCreate = async () => {
    if (!form.playerA || !form.playerB || !form.eventDate || !form.eventTime) { toast.error('Player A, Player B, Date and Start Time required'); return; }
    try {
      await createGame.mutateAsync({ data: { sport: form.sport, playerA: form.playerA, playerB: form.playerB, eventDate: form.eventDate, eventTime: form.eventTime, eventEndDate: form.eventEndDate || undefined, eventEndTime: form.eventEndTime || undefined, city: form.city || undefined, country: form.country || undefined } as any });
      invalidate(); toast.success('Game created');
      setShowForm(false); setForm(EMPTY_FORM);
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const startEdit = (game: any) => {
    setEditId(game.id);
    setEditForm({
      sport: game.sport || 'pool', playerA: game.playerA || '', playerB: game.playerB || '',
      eventDate: game.eventDate || '', eventTime: game.eventTime || '',
      eventEndDate: game.eventEndDate || '', eventEndTime: game.eventEndTime || '',
      city: game.city || '', country: game.country || '',
    });
    setShowForm(false);
  };

  const handleEdit = async () => {
    if (!editForm.playerA || !editForm.playerB || !editForm.eventDate || !editForm.eventTime) { toast.error('Required fields missing'); return; }
    try {
      setEditSaving(true);
      await updateGame.mutateAsync({ id: editId!, data: { sport: editForm.sport, playerA: editForm.playerA, playerB: editForm.playerB, eventDate: editForm.eventDate, eventTime: editForm.eventTime, eventEndDate: editForm.eventEndDate || undefined, eventEndTime: editForm.eventEndTime || undefined, city: editForm.city || undefined, country: editForm.country || undefined } as any });
      invalidate(); toast.success('Game updated'); setEditId(null);
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
    finally { setEditSaving(false); }
  };

  const handleSettle = async (id: number) => {
    try {
      await settleGame.mutateAsync({ id, data: { result: settleResult } });
      invalidate(); toast.success('Game settled and bets resolved'); setSettleId(null);
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelGame.mutateAsync({ id });
      invalidate(); toast.success('Game cancelled and stakes refunded');
    } catch (e: any) { toast.error(e?.data?.error || 'Failed'); }
  };

  const formatDateRange = (game: any) => {
    let s = `${game.eventDate} ${game.eventTime}`;
    if (game.eventEndDate) s += ` → ${game.eventEndDate}${game.eventEndTime ? ' ' + game.eventEndTime : ''}`;
    return s;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Trophy className="h-6 w-6 text-amber-400" /> Manage Games</h1>
        <Button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="bg-amber-500 hover:bg-amber-400 text-slate-950">
          <Plus className="h-4 w-4 mr-1" /> New Game
        </Button>
      </div>

      {showForm && (
        <GameForm form={form} setForm={setForm} onSave={handleCreate} onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          saving={createGame.isPending} title="Create Game" accentClass="border-amber-500/30" />
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(gamesData?.games || []).map((game: any) => (
            <div key={game.id}>
              <Card className={`bg-slate-900 border-primary/20 ${editId === game.id ? 'border-amber-500/40' : ''}`}>
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${STATUS_COLORS[game.status]} border text-xs`}>{game.status}</Badge>
                      <span className="text-xs text-slate-500 capitalize">{game.sport}</span>
                      <span className="text-xs text-slate-500">{game.openBetsCount} open · {game.matchedBetsCount} matched</span>
                    </div>
                    <p className="text-white font-semibold">{game.playerA} <span className="text-slate-500">vs</span> {game.playerB}</p>
                    <p className="text-xs text-slate-400">
                      {formatDateRange(game)}
                      {(game.city || game.country) ? ` · ${[game.city, game.country].filter(Boolean).join(', ')}` : ''}
                      {` · Pool: $${(game.totalBetPool || 0).toFixed(2)}`}
                    </p>
                    {game.result && <p className="text-xs text-teal-400 mt-1">Result: {game.result.replace(/_/g, ' ')}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => editId === game.id ? setEditId(null) : startEdit(game)} className="h-7 w-7 p-0 text-slate-400 hover:text-amber-400">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {['upcoming', 'live'].includes(game.status) && (
                      settleId === game.id ? (
                        <div className="flex gap-2 items-center">
                          <select value={settleResult} onChange={(e) => setSettleResult(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-white text-xs">
                            <option value="player_a_wins">{game.playerA} Wins</option>
                            <option value="player_b_wins">{game.playerB} Wins</option>
                            <option value="draw">Draw</option>
                          </select>
                          <Button size="sm" onClick={() => handleSettle(game.id)} className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-7 text-xs">Settle</Button>
                          <Button size="sm" variant="ghost" onClick={() => setSettleId(null)} className="text-slate-400 h-7 text-xs">Cancel</Button>
                        </div>
                      ) : (
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
              {editId === game.id && (
                <div className="mt-2">
                  <GameForm form={editForm} setForm={setEditForm} onSave={handleEdit} onCancel={() => setEditId(null)}
                    saving={editSaving} title="Edit Game" accentClass="border-amber-500/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
