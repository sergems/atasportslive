import React, { useEffect, useState } from 'react';
import { useGetStreamingReport, useGetBettingReport, useGetWalletReport, useGetRevenueBreakdown } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Radio, Trophy, Wallet } from 'lucide-react';

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AdminReports() {
  useEffect(() => { document.title = 'Reports - Admin'; }, []);

  const [period, setPeriod] = useState('monthly');

  const { data: streaming } = useGetStreamingReport({ period });
  const { data: betting } = useGetBettingReport({ period });
  const { data: wallet } = useGetWalletReport({ period });
  const { data: revenue } = useGetRevenueBreakdown({ period });

  const chartData = revenue?.data || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><TrendingUp className="h-6 w-6 text-purple-400" /> Reports</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${period === p ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-purple-500/20">
          <CardContent className="pt-6">
            <Radio className="h-5 w-5 text-purple-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-purple-400">${(streaming?.totalRevenue || 0).toFixed(2)}</div>
            <div className="text-slate-400 text-sm mt-1">Streaming Revenue</div>
            <div className="text-slate-500 text-xs">{streaming?.totalAccesses || 0} stream accesses</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-amber-500/20">
          <CardContent className="pt-6">
            <Trophy className="h-5 w-5 text-amber-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-amber-400">${(betting?.brokerageRevenue || 0).toFixed(2)}</div>
            <div className="text-slate-400 text-sm mt-1">Brokerage Revenue</div>
            <div className="text-slate-500 text-xs">{betting?.totalBetsPlaced || 0} bets · {betting?.totalBetsMatched || 0} matched</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-teal-500/20">
          <CardContent className="pt-6">
            <Wallet className="h-5 w-5 text-teal-400 mb-2" />
            <div className="text-2xl font-bold font-mono text-teal-400">${(wallet?.netFlow || 0).toFixed(2)}</div>
            <div className="text-slate-400 text-sm mt-1">Net Wallet Flow</div>
            <div className="text-slate-500 text-xs">+${(wallet?.totalDeposits || 0).toFixed(2)} in · -${(wallet?.totalWithdrawals || 0).toFixed(2)} out</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <Card className="bg-slate-900 border-primary/20">
          <CardHeader><CardTitle className="text-white">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`]}
                />
                <Legend />
                <Bar dataKey="streaming" name="Streaming" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="brokerage" name="Brokerage" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
