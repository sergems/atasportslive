import React, { useEffect, useState } from 'react';
import { useGetStreamingReport, useGetBettingReport, useGetWalletReport, useGetRevenueBreakdown } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Radio, Trophy, Wallet, Download, Mail, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function AdminReports() {
  useEffect(() => { document.title = 'Reports - Admin'; }, []);

  const { token } = useAuthStore();
  const [period, setPeriod] = useState('monthly');
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());

  const [exportState, setExportState] = useState<'idle' | 'loading'>('idle');
  const [sendState, setSendState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [sendMsg, setSendMsg] = useState('');

  const { data: streaming } = useGetStreamingReport({ period: period as any });
  const { data: betting } = useGetBettingReport({ period: period as any });
  const { data: wallet } = useGetWalletReport({ period: period as any });
  const { data: revenue } = useGetRevenueBreakdown({ period: period as any });

  const chartData = revenue?.data || [];

  async function handleExport() {
    setExportState('loading');
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ata-report-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed — please try again.');
    } finally {
      setExportState('idle');
    }
  }

  async function handleSend() {
    setSendState('loading');
    setSendMsg('');
    try {
      const res = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSendState('ok');
        setSendMsg(data.message);
      } else {
        setSendState('error');
        setSendMsg(data.message || 'Send failed');
      }
    } catch {
      setSendState('error');
      setSendMsg('Network error — please try again.');
    }
    setTimeout(() => setSendState('idle'), 5000);
  }

  return (
    <div className="space-y-8">

      {/* Header + period filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-purple-400" /> Reports
        </h1>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${period === p ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
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

      {/* Export Panel */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-teal-400" /> Export Full Report (CSV)
          </CardTitle>
          <p className="text-slate-500 text-xs mt-1">
            Includes all transactions, bets, stream accesses and wallet balances for the selected period.
            Sent weekly every Monday 08:00 EAT automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium uppercase tracking-wider">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                max={today()}
                className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 cursor-pointer"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Quick presets */}
              {[
                { label: 'Last 7d', days: 7 },
                { label: 'Last 30d', days: 30 },
                { label: 'Last 90d', days: 90 },
              ].map(({ label, days }) => (
                <button key={days}
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - days);
                    setFrom(d.toISOString().slice(0, 10));
                    setTo(today());
                  }}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={handleExport}
              disabled={exportState === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportState === 'loading'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                : <><Download className="h-4 w-4" /> Export CSV</>}
            </button>

            <button
              onClick={handleSend}
              disabled={sendState === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed border border-slate-600"
            >
              {sendState === 'loading'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : sendState === 'ok'
                ? <><Check className="h-4 w-4 text-teal-400" /> Sent!</>
                : <><Mail className="h-4 w-4 text-slate-400" /> Send to info@atasportslive.com</>}
            </button>

            {sendMsg && (
              <p className={`text-xs flex items-center gap-1.5 ${sendState === 'ok' || sendMsg.includes('sent') ? 'text-teal-400' : 'text-amber-400'}`}>
                {sendState === 'error' && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                {sendMsg}
              </p>
            )}
          </div>

          <p className="text-slate-600 text-[11px]">
            ℹ️ Weekly automated reports are emailed every <strong className="text-slate-500">Monday at 08:00 EAT</strong> to info@atasportslive.com.
            SMTP must be configured in Admin → Settings for email delivery.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
