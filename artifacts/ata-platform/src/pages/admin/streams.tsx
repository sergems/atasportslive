import React, { useEffect, useState } from 'react';
import { useListStreams, useCreateStream, useUpdateStream, useGoLive, useEndStream } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Radio, Plus, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListStreamsQueryKey } from '@workspace/api-client-react';

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  live: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  ended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const SPORTS = ['pool', 'boxing', 'football', 'athletics', 'basketball'];

export default function AdminStreams() {
  useEffect(() => { document.title = 'Manage Streams - Admin'; }, []);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [goLiveId, setGoLiveId] = useState<number | null>(null);
  const [hlsUrl, setHlsUrl] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', sport: 'pool', thumbnailUrl: '', startTime: '', endTime: '', accessPrice: '1.50',
  });

  const { data: streamsData, isLoading } = useListStreams({ limit: 50 });
  const createStream = useCreateStream();
  const goLive = useGoLive();
  const endStream = useEndStream();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStreamsQueryKey() });

  const handleCreate = async () => {
    if (!form.title || !form.sport || !form.startTime) { toast.error('Title, sport, and start time required'); return; }
    try {
      await createStream.mutateAsync({ data: { ...form, accessPrice: parseFloat(form.accessPrice) } });
      invalidate();
      toast.success('Stream created');
      setShowForm(false);
      setForm({ title: '', description: '', sport: 'pool', thumbnailUrl: '', startTime: '', endTime: '', accessPrice: '1.50' });
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to create stream');
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
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to go live');
    }
  };

  const handleEnd = async (id: number) => {
    try {
      await endStream.mutateAsync({ id });
      invalidate();
      toast.success('Stream ended');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Failed to end stream');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Radio className="h-6 w-6 text-teal-400" /> Manage Streams</h1>
        <Button onClick={() => setShowForm(!showForm)} className="bg-teal-500 hover:bg-teal-400 text-slate-950">
          <Plus className="h-4 w-4 mr-1" /> New Stream
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-teal-500/30">
          <CardHeader><CardTitle className="text-white">Create Stream</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label className="text-slate-300">Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">Sport</Label>
              <select value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white text-sm">
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-slate-300">Start Time</Label><Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">End Time</Label><Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">Access Price ($)</Label><Input type="number" step="0.01" value={form.accessPrice} onChange={(e) => setForm({ ...form, accessPrice: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="space-y-1"><Label className="text-slate-300">Thumbnail URL</Label><Input value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="md:col-span-2 space-y-1"><Label className="text-slate-300">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="md:col-span-2 flex gap-3">
              <Button onClick={handleCreate} disabled={createStream.isPending} className="bg-teal-500 hover:bg-teal-400 text-slate-950">{createStream.isPending ? 'Creating...' : 'Create'}</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-400">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 bg-slate-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {(streamsData?.streams || []).map((stream: any) => (
            <Card key={stream.id} className="bg-slate-900 border-primary/20">
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${STATUS_COLORS[stream.status] || 'bg-slate-700 text-slate-300'} border text-xs`}>{stream.status}</Badge>
                    <span className="text-xs text-slate-500 capitalize">{stream.sport}</span>
                  </div>
                  <p className="text-white font-semibold">{stream.title}</p>
                  <p className="text-xs text-slate-400">{new Date(stream.startTime).toLocaleString()} · ${stream.accessPrice}/day</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {stream.status === 'upcoming' && (
                    goLiveId === stream.id ? (
                      <div className="flex gap-2 items-center">
                        <Input value={hlsUrl} onChange={(e) => setHlsUrl(e.target.value)} placeholder="HLS URL..." className="bg-slate-800 border-slate-700 text-white w-48 h-8 text-xs" />
                        <Button size="sm" onClick={() => handleGoLive(stream.id)} className="bg-teal-500 hover:bg-teal-400 text-slate-950 h-8 text-xs">Go Live</Button>
                        <Button size="sm" variant="ghost" onClick={() => setGoLiveId(null)} className="text-slate-400 h-8 text-xs">Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setGoLiveId(stream.id)} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 h-8 text-xs">
                        <Play className="h-3 w-3 mr-1" /> Go Live
                      </Button>
                    )
                  )}
                  {stream.status === 'live' && (
                    <Button size="sm" variant="destructive" onClick={() => handleEnd(stream.id)} className="h-8 text-xs">
                      <Square className="h-3 w-3 mr-1" /> End
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
