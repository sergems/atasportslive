import React, { useEffect, useState } from 'react';
import { useListTransactions } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History } from 'lucide-react';

const TX_COLORS: Record<string, string> = {
  deposit: 'text-teal-400',
  withdrawal: 'text-red-400',
  bet_stake: 'text-amber-400',
  bet_win: 'text-teal-400',
  bet_refund: 'text-blue-400',
  brokerage_fee: 'text-slate-400',
  stream_access: 'text-purple-400',
  voucher_redeem: 'text-teal-400',
  admin_credit: 'text-teal-400',
  admin_debit: 'text-red-400',
};

const TX_SIGN: Record<string, string> = {
  deposit: '+', withdrawal: '-', bet_stake: '-', bet_win: '+',
  bet_refund: '+', stream_access: '-', brokerage_fee: '-',
  voucher_redeem: '+', admin_credit: '+', admin_debit: '-',
};

const TX_LABELS: Record<string, string> = {
  deposit: 'Deposit', withdrawal: 'Withdrawal', bet_stake: 'Bet Placed',
  bet_win: 'Bet Won', bet_refund: 'Bet Refund', stream_access: 'Stream Access',
  brokerage_fee: 'Brokerage Fee', voucher_redeem: 'Voucher Redeemed',
  admin_credit: 'Admin Credit', admin_debit: 'Admin Debit',
};

const ALL_TYPES = ['all', 'deposit', 'withdrawal', 'bet_stake', 'bet_win', 'bet_refund', 'stream_access', 'brokerage_fee', 'voucher_redeem'];

export default function Transactions() {
  useEffect(() => { document.title = 'Transactions - ATA Platform'; }, []);
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: txData, isLoading } = useListTransactions({ limit: 100 });

  const transactions = (txData?.transactions || []).filter((tx: any) =>
    typeFilter === 'all' || tx.type === typeFilter
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Transactions</h1>
        <p className="text-slate-400 mt-1">Full history of your wallet activity.</p>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              typeFilter === t
                ? 'bg-teal-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {t === 'all' ? 'All' : TX_LABELS[t] || t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <Card className="bg-slate-900 border-primary/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <History className="h-5 w-5" /> Transaction History
            {!isLoading && (
              <span className="text-sm font-normal text-slate-500 ml-2">{transactions.length} records</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800 rounded-lg" />)}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-12">No transactions found.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-3.5">
                  <div>
                    <div className="text-sm text-white font-medium">{TX_LABELS[tx.type] || tx.type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-UG', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                    {tx.description && (
                      <div className="text-xs text-slate-600 mt-0.5">{tx.description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-semibold text-sm ${TX_COLORS[tx.type] || 'text-white'}`}>
                      {TX_SIGN[tx.type] || ''}${tx.amount.toFixed(2)}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] border-slate-700 mt-1 ${
                        tx.status === 'completed' ? 'text-teal-400' :
                        tx.status === 'pending' ? 'text-amber-400' : 'text-red-400'
                      }`}
                    >
                      {tx.status}
                    </Badge>
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
