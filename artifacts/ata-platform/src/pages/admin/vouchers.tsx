import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ticket, Plus, Copy, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth-store';

const AMOUNTS = [1, 5, 10, 20, 50];

function authHeaders() {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function fetchVouchers() {
  const res = await fetch('/api/admin/vouchers', { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load vouchers');
  return res.json();
}

async function generateVouchers(amount: number, quantity: number) {
  const res = await fetch('/api/admin/vouchers', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, quantity }),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
  return res.json();
}


export default function AdminVouchers() {
  useEffect(() => { document.title = 'Vouchers - Admin'; }, []);

  const qc = useQueryClient();
  const [amount, setAmount] = useState<number>(5);
  const [quantity, setQuantity] = useState(1);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: vouchers, isLoading } = useQuery({ queryKey: ['admin-vouchers'], queryFn: fetchVouchers });

  const generate = useMutation({
    mutationFn: () => generateVouchers(amount, quantity),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-vouchers'] });
      toast.success(`Generated ${data.length} voucher${data.length > 1 ? 's' : ''}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const available = (vouchers as any[])?.filter((v: any) => !v.isRedeemed) || [];
  const redeemed = (vouchers as any[])?.filter((v: any) => v.isRedeemed) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Ticket className="h-6 w-6 text-purple-400" /> Voucher Management
      </h1>

      {/* Generate */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader><CardTitle className="text-white text-base">Generate Vouchers</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Value (USD)</Label>
              <Select value={String(amount)} onValueChange={v => setAmount(Number(v))}>
                <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {AMOUNTS.map(a => (
                    <SelectItem key={a} value={String(a)} className="text-white">${a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Quantity (max 50)</Label>
              <Input
                type="number" min={1} max={50} value={quantity}
                onChange={e => setQuantity(Math.min(50, Math.max(1, Number(e.target.value))))}
                className="w-24 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {generate.isPending ? 'Generating…' : `Generate ${quantity > 1 ? `${quantity} × ` : ''}$${amount}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available vouchers */}
      <Card className="bg-slate-900 border-primary/20">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            Available
            <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">{available.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800 rounded" />)}</div>
          ) : !available.length ? (
            <p className="text-slate-500 text-sm text-center py-6">No available vouchers. Generate some above.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {available.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                  <div>
                    <div className="font-mono text-lg font-bold text-white tracking-widest">{v.code}</div>
                    <div className="text-amber-400 font-semibold text-sm">${v.amount.toFixed(2)}</div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => copyCode(v.id, v.code)}>
                    {copiedId === v.id ? <CheckCheck className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redeemed vouchers */}
      {redeemed.length > 0 && (
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              Redeemed
              <Badge className="bg-slate-700 text-slate-400 border-slate-600">{redeemed.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {redeemed.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-2.5 opacity-60">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-base text-slate-400 tracking-widest line-through">{v.code}</span>
                    <span className="text-amber-500 text-sm font-semibold">${v.amount.toFixed(2)}</span>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{v.redeemedByName || `User #${v.redeemedBy}`}</div>
                    <div>{v.redeemedAt ? new Date(v.redeemedAt).toLocaleString() : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
