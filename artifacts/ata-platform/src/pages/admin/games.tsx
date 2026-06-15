import React, { useEffect, useState } from 'react';
import { useListGames, useCreateGame, useSettleGame, useCancelGame } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Plus, CheckCircle, XCircle } from 'lucide-react';
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

export default function AdminGames() {
  useEffect(() => { document.title = 'Manage Games - Admin'; }, []);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [settleId, setSettleId] = useState<number | null>(null);
  const [settleResult, setSettleResult] = useState('player_a_wins');
  const [form, setForm] = useState({ sport: 'pool', playerA: '', playerB: '', eventDate: '', eventTime: '' });

  const { data: gamesData, isLoading } = useListGames({ limit: 50 });
  const createGame = useCreateGame();
  const settleGame = useSettleGame();
  const cancelGame = useCancelGame();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });

  const handleCreate = async () => {
    if (!form.playerA || !form.playerB || !form.eventDate || !form.eventTime) { toast.error('All fields required'); return; }
    try {
      await createGame.mutateAsync({ data: form });
      invalidate();
      toast.success('Game created');
      setShowForm(false);
      setForm({ sport: 'pool', playerA: '', playerB: '', eventDate: '', eventTime: '' });
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const handleSettle = async (id: number) => {
    try {
      await settleGame.mutateAsync({ id, data: { result: settleResult } });
      invalidate();
      toast.success('Game settled and bets resolved');
      setSettleId(null);
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelGame.mutateAsync({ id });
      invalidate();
      toast.success('Game cancelled and stakes refunded');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Trophy className="h-6 w-6 text-amber-400" /> Manage Games</h1>
        <Button onClick={() => setShowForm(!showForm)} className="bg-amber-500 hover:bg-amber-400 text-slate-950">
          <Plus className="h-4 w-4 mr-1" /> New Game
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-amber-500/30">
          <CardHeader><CardTitle className="text-white">Create Game</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-slate-300">Sport</Label>
              <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm">
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-slate-300">Player A</Label><Input value={form.playerA} onChange={(e) => setForm({ ...form, playerA: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">Player B</Label><Input value={form.playerB} onChange={(e) => setForm({ ...form, playerB: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">Event Date</Label><Input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">Event Time</Label><Input type="time" value={form.eventTime} onChange={(e) => setForm({ ...form, eventTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="md:col-span-2 flex gap-3">
              <Button onClick={handleCreate} disabled={createGame.isPending} className="bg-amber-500 hover:bg-amber-400 text-slate-950">{createGame.isPending ? 'Creating...' : 'Create'}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(gamesData?.games || []).map((game: any) => (
            <Card key={game.id} className="bg-slate-900 border-primary/20">
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${STATUS_COLORS[game.status]} border text-xs`}>{game.status}</Badge>
                    <span className="text-xs text-slate-500 capitalize">{game.sport}</span>
                    <span className="text-xs text-slate-500">{game.openBetsCount} open · {game.matchedBetsCount} matched</span>
                  </div>
                  <p className="text-white font-semibold">{game.playerA} <span className="text-slate-500">vs</span> {game.playerB}</p>
                  <p className="text-xs text-slate-400">{game.eventDate} {game.eventTime} · Pool: ${game.totalBetPool.toFixed(2)}</p>
                  {game.result && <p className="text-xs text-teal-400 mt-1">Result: {game.result.replace(/_/g, ' ')}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
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
          ))}
        </div>
      )}
    </div>
  );
}
