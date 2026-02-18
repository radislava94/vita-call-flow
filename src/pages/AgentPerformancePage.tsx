import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Search, TrendingUp, Package, DollarSign, CheckCircle, Undo2, XCircle, Percent, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

async function fetchPerformance(params: { from?: string; to?: string; search?: string }) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  const sp = new URLSearchParams();
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.search) sp.set('search', params.search);
  const res = await fetch(`${API_BASE}/agent-performance?${sp.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

interface AgentPerf {
  user_id: string;
  full_name: string;
  email: string;
  total_shipped: number;
  total_earned: number;
  avg_order_value: number;
  shipped_this_month: number;
  total_paid: number;
  total_confirmed: number;
  total_returned: number;
  total_cancelled: number;
  total_taken: number;
  conversion_rate: number;
  return_rate: number;
  total_profit: number | null;
}

type FilterPreset = 'today' | 'week' | 'month' | 'custom';

function getDateRange(preset: FilterPreset): { from: string; to: string } | null {
  const now = new Date();
  const toStr = new Date(now.getTime() + 86400000).toISOString().substring(0, 10);
  if (preset === 'today') return { from: now.toISOString().substring(0, 10), to: toStr };
  if (preset === 'week') return { from: new Date(now.getTime() - 7 * 86400000).toISOString().substring(0, 10), to: toStr };
  if (preset === 'month') return { from: new Date(now.getTime() - 30 * 86400000).toISOString().substring(0, 10), to: toStr };
  return null;
}

function exportCSV(data: AgentPerf[]) {
  const header = 'Agent Name,Email,Paid Orders,Shipped,Confirmed,Returned,Cancelled,Total Earned,Avg Order Value,Conversion Rate %,Return Rate %,Profit';
  const rows = data.map(a =>
    `"${a.full_name}","${a.email}",${a.total_paid},${a.total_shipped},${a.total_confirmed},${a.total_returned},${a.total_cancelled},${a.total_earned.toFixed(2)},${a.avg_order_value.toFixed(2)},${a.conversion_rate},${a.return_rate},${a.total_profit !== null ? a.total_profit.toFixed(2) : 'N/A'}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agent-performance-${new Date().toISOString().substring(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AgentPerformancePage() {
  const { toast } = useToast();
  const [data, setData] = useState<AgentPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterPreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');

  const loadData = (preset: FilterPreset, cFrom?: string, cTo?: string) => {
    setLoading(true);
    let range = getDateRange(preset);
    if (preset === 'custom' && cFrom && cTo) range = { from: cFrom, to: cTo };
    fetchPerformance({ from: range?.from, to: range?.to, search: search || undefined })
      .then(setData)
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filter); }, []);

  const handleFilterChange = (preset: FilterPreset) => {
    setFilter(preset);
    if (preset !== 'custom') loadData(preset);
  };

  const handleSearch = () => loadData(filter, customFrom, customTo);

  const totals = useMemo(() => {
    const shipped = data.reduce((s, a) => s + a.total_shipped, 0);
    const earned = data.reduce((s, a) => s + a.total_earned, 0);
    const paid = data.reduce((s, a) => s + a.total_paid, 0);
    const confirmed = data.reduce((s, a) => s + a.total_confirmed, 0);
    const returned = data.reduce((s, a) => s + a.total_returned, 0);
    const cancelled = data.reduce((s, a) => s + a.total_cancelled, 0);
    const taken = data.reduce((s, a) => s + a.total_taken, 0);
    const conversionRate = taken > 0 ? Math.round((paid / taken) * 10000) / 100 : 0;
    const returnRate = shipped > 0 ? Math.round((returned / shipped) * 10000) / 100 : 0;
    const hasProfit = data.some(a => a.total_profit !== null);
    const profit = hasProfit ? data.reduce((s, a) => s + (a.total_profit || 0), 0) : null;
    return { shipped, earned, paid, confirmed, returned, cancelled, taken, conversionRate, returnRate, profit, hasProfit };
  }, [data]);

  return (
    <AppLayout title="Performance">
      {/* KPI Cards Row 1 - Financial */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Total Earned" value={totals.earned.toFixed(2)} accent />
        <SummaryCard icon={<CheckCircle className="h-5 w-5" />} label="Total Paid" value={String(totals.paid)} />
        <SummaryCard icon={<Truck className="h-5 w-5" />} label="Total Shipped" value={String(totals.shipped)} />
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Total Confirmed" value={String(totals.confirmed)} />
        <SummaryCard icon={<Undo2 className="h-5 w-5" />} label="Total Returned" value={String(totals.returned)} negative />
        <SummaryCard icon={<XCircle className="h-5 w-5" />} label="Total Cancelled" value={String(totals.cancelled)} negative />
      </div>

      {/* KPI Cards Row 2 - Rates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard icon={<Percent className="h-5 w-5" />} label="Conversion Rate" value={`${totals.conversionRate}%`} />
        <SummaryCard icon={<Percent className="h-5 w-5" />} label="Return Rate" value={`${totals.returnRate}%`} negative={totals.returnRate > 10} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Agents" value={String(data.length)} />
        {totals.hasProfit && (
          <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Total Profit" value={(totals.profit ?? 0).toFixed(2)} accent />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['today', 'week', 'month', 'custom'] as FilterPreset[]).map(p => (
          <Button key={p} variant={filter === p ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange(p)}>
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
          </Button>
        ))}
        {filter === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-auto" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-auto" />
            <Button size="sm" onClick={() => loadData('custom', customFrom, customTo)}>Apply</Button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agent..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-9 pl-8 w-48"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(data)} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No data found.</div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Shipped</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Confirmed</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Returned</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Cancelled</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Revenue (Paid)</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Avg Order</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Conv. %</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ret. %</th>
                  {totals.hasProfit && <th className="text-right px-3 py-3 font-medium text-muted-foreground">Profit</th>}
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">This Month</th>
                </tr>
              </thead>
              <tbody>
                {data.map((agent, i) => (
                  <tr key={agent.user_id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                          {agent.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-card-foreground truncate">{agent.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{agent.total_paid}</td>
                    <td className="px-3 py-3 text-right">{agent.total_shipped}</td>
                    <td className="px-3 py-3 text-right">{agent.total_confirmed}</td>
                    <td className="px-3 py-3 text-right text-destructive">{agent.total_returned}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{agent.total_cancelled}</td>
                    <td className="px-3 py-3 text-right font-semibold text-primary">{agent.total_earned.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right">{agent.avg_order_value.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${agent.conversion_rate >= 50 ? 'bg-green-500/10 text-green-600' : agent.conversion_rate >= 25 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-destructive/10 text-destructive'}`}>
                        {agent.conversion_rate}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${agent.return_rate <= 5 ? 'bg-green-500/10 text-green-600' : agent.return_rate <= 15 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-destructive/10 text-destructive'}`}>
                        {agent.return_rate}%
                      </span>
                    </td>
                    {totals.hasProfit && (
                      <td className="px-3 py-3 text-right font-semibold">
                        {agent.total_profit !== null ? agent.total_profit.toFixed(2) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {agent.shipped_this_month}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function SummaryCard({ icon, label, value, accent, negative }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 flex items-center gap-3 shadow-sm ${accent ? 'ring-1 ring-primary/20' : ''}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${negative ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className={`text-lg font-bold truncate ${accent ? 'text-primary' : negative ? 'text-destructive' : 'text-card-foreground'}`}>{value}</p>
      </div>
    </div>
  );
}
