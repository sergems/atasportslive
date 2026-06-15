import React, { useEffect } from 'react';
import { useListPendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getListPendingWithdrawalsQueryKey } from '@workspace/api-client-react';

const METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo', airtel_money: 'Airtel Money', btc_binance: 'Bitcoin',
};

export default function AdminWallets() {
  useEffect(() => { document.title = 'Wallet Management - Admin'; }, []);

  const queryClient = useQueryClient();
  const { data: withdrawals, isLoading } = useListPendingWithdrawals();
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPendingWithdrawalsQueryKey() });

  const handleApprove = async (id: number) => {
    try {
      await approve.mutateAsync({ id });
      invalidate();
      toast.success('Withdrawal approved and processed');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  const handleReject = async (id: number) => {
    try {
      await reject.mutateAsync({ id });
      invalidate();
      toast.success('Withdrawal rejected and funds returned');
    } catch (err: any) { toast.error(err?.data?.error || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Wallet className="h-6 w-6 text-green-400" /> Wallet Management</h1>

      <Card className="bg-slate-900 border-primary/20">
        <CardHeader><CardTitle className="text-white">Pending Withdrawals {withdrawals?.length ? <Badge className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30">{withdrawals.length}</Badge> : null}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 bg-slate-800 rounded" />)}</div>
          ) : !withdrawals?.length ? (
            <p className="text-slate-500 text-sm text-center py-8">No pending withdrawals.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                  <div>
                    <div className="text-white font-semibold">{tx.userFullName || `User #${tx.userId}`}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod} · {tx.reference}</div>
                    <div className="text-slate-500 text-xs">{new Date(tx.createdAt).toLocaleString()} · {tx.transactionId}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-amber-400 font-mono font-bold text-lg">${tx.amount.toFixed(2)}</div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(tx.id)} className="bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 h-8">
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(tx.id)} className="h-8">
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
