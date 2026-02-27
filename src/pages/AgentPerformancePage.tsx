import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Search, TrendingUp, Package, DollarSign, CheckCircle, Undo2, XCircle, Percent, Truck, Users, Target, BarChart3 } from 'lucide-react';
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
  leads_assigned: number;
  total_confirmed: number;
  total_shipped: number;
  total_paid: number;
  total_returned: number;
  total_cancelled: number;
  conversion_rate: number;
  shipment_rate: number;
  collection_rate: number;
  return_rate: number;
  gross_revenue: number;
  paid_revenue: number;
  outstanding_revenue: number;
  returned_value: number;
  total_profit: number;
  avg_order_value: number;
  revenue_per_lead: number;
  profit_per_lead: number;
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

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(2);

function exportCSV(data: AgentPerf[]) {
  const header = 'Agent,Leads,Confirmed,Shipped,Paid,Returned,Cancelled,Conv%,Ship%,Collect%,Ret%,Gross Rev,Paid Rev,Outstanding,Returned Val,Profit,AOV,Rev/Lead,Profit/Lead';
  const rows = data.map(a =>
    `"${a.full_name}",${a.leads_assigned},${a.total_confirmed},${a.total_shipped},${a.total_paid},${a.total_returned},${a.total_cancelled},${a.conversion_rate},${a.shipment_rate},${a.collection_rate},${a.return_rate},${a.gross_revenue.toFixed(2)},${a.paid_revenue.toFixed(2)},${a.outstanding_revenue.toFixed(2)},${a.returned_value.toFixed(2)},${a.total_profit.toFixed(2)},${a.avg_order_value.toFixed(2)},${a.revenue_per_lead.toFixed(2)},${a.profit_per_lead.toFixed(2)}`
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
    const leads = data.reduce((s, a) => s + a.leads_assigned, 0);
    const confirmed = data.reduce((s, a) => s + a.total_confirmed, 0);
    const shipped = data.reduce((s, a) => s + a.total_shipped, 0);
    const paid = data.reduce((s, a) => s + a.total_paid, 0);
    const returned = data.reduce((s, a) => s + a.total_returned, 0);
    const cancelled = data.reduce((s, a) => s + a.total_cancelled, 0);
    const grossRevenue = data.reduce((s, a) => s + a.gross_revenue, 0);
    const paidRevenue = data.reduce((s, a) => s + a.paid_revenue, 0);
    const outstanding = data.reduce((s, a) => s + a.outstanding_revenue, 0);
    const returnedValue = data.reduce((s, a) => s + a.returned_value, 0);
    const profit = data.reduce((s, a) => s + a.total_profit, 0);
    const convRate = leads > 0 ? Math.round((confirmed / leads) * 10000) / 100 : 0;
    const shipRate = confirmed > 0 ? Math.round((shipped / confirmed) * 10000) / 100 : 0;
    const collectRate = shipped > 0 ? Math.round((paid / shipped) * 10000) / 100 : 0;
    const retRate = shipped > 0 ? Math.round((returned / shipped) * 10000) / 100 : 0;
    const aov = paid > 0 ? Math.round((paidRevenue / paid) * 100) / 100 : 0;
    return { leads, confirmed, shipped, paid, returned, cancelled, grossRevenue, paidRevenue, outstanding, returnedValue, profit, convRate, shipRate, collectRate, retRate, aov };
  }, [data]);

  return (
    <AppLayout title="Performance">
      {/* === SUMMARY SECTIONS === */}

      {/* Activity */}
      <Card className="mb-4 border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Sales Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard label="Leads Assigned" value={String(totals.leads)} desc="All orders assigned" />
            <SummaryCard label="Confirmed" value={String(totals.confirmed)} desc="Confirmed+" />
            <SummaryCard label="Shipped" value={String(totals.shipped)} desc="Shipped+" />
            <SummaryCard label="Paid" value={String(totals.paid)} accent desc="Status = Paid" />
            <SummaryCard label="Returned" value={String(totals.returned)} negative desc="Status = Returned" />
            <SummaryCard label="Cancelled" value={String(totals.cancelled)} negative desc="Status = Cancelled" />
          </div>
        </CardContent>
      </Card>

      {/* Quality */}
      <Card className="mb-4 border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Sales Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Conversion Rate" value={`${totals.convRate}%`} desc="Confirmed / Leads" />
            <SummaryCard label="Shipment Rate" value={`${totals.shipRate}%`} desc="Shipped / Confirmed" />
            <SummaryCard label="Collection Rate" value={`${totals.collectRate}%`} desc="Paid / Shipped" accent />
            <SummaryCard label="Return Rate" value={`${totals.retRate}%`} negative={totals.retRate > 10} desc="Returned / Shipped" />
          </div>
        </CardContent>
      </Card>

      {/* Financial */}
      <Card className="mb-6 border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Financial Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <SummaryCard label="Gross Revenue" value={fmt(totals.grossRevenue)} accent desc="Shipped + Paid" />
            <SummaryCard label="Paid Revenue" value={fmt(totals.paidRevenue)} accent desc="Paid only" />
            <SummaryCard label="Outstanding" value={fmt(totals.outstanding)} desc="Shipped only" />
            <SummaryCard label="Returned Val" value={fmt(totals.returnedValue)} negative desc="Returned only" />
            <SummaryCard label="Profit" value={fmt(totals.profit)} accent desc="Paid − cost" />
            <SummaryCard label="Avg Order" value={fmt(totals.aov)} desc="Paid Rev / Paid" />
            <SummaryCard label="Rev / Lead" value={totals.leads > 0 ? fmt(totals.paidRevenue / totals.leads) : '0'} desc="Paid Rev / Leads" />
            <SummaryCard label="Profit / Lead" value={totals.leads > 0 ? fmt(totals.profit / totals.leads) : '0'} desc="Profit / Leads" />
          </div>
        </CardContent>
      </Card>

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
            <Input placeholder="Search agent..." value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} className="h-9 pl-8 w-48" />
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
                  {/* Activity */}
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Leads</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Conf.</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ship.</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ret.</th>
                  {/* Quality */}
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Conv%</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Coll%</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ret%</th>
                  {/* Financial */}
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Paid Rev</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Outstand.</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Profit</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">AOV</th>
                </tr>
              </thead>
              <tbody>
                {data.map((a, i) => (
                  <tr key={a.user_id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                          {a.full_name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-card-foreground truncate">{a.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">{a.leads_assigned}</td>
                    <td className="px-3 py-3 text-right">{a.total_confirmed}</td>
                    <td className="px-3 py-3 text-right">{a.total_shipped}</td>
                    <td className="px-3 py-3 text-right font-semibold">{a.total_paid}</td>
                    <td className="px-3 py-3 text-right text-destructive">{a.total_returned}</td>
                    <td className="px-3 py-3 text-right">
                      <RateBadge value={a.conversion_rate} thresholds={[25, 50]} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <RateBadge value={a.collection_rate} thresholds={[40, 70]} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <RateBadge value={a.return_rate} thresholds={[15, 5]} invert />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-primary">{fmt(a.paid_revenue)}</td>
                    <td className="px-3 py-3 text-right">{fmt(a.outstanding_revenue)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{fmt(a.total_profit)}</td>
                    <td className="px-3 py-3 text-right">{fmt(a.avg_order_value)}</td>
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

function RateBadge({ value, thresholds, invert }: { value: number; thresholds: [number, number]; invert?: boolean }) {
  let color: string;
  if (invert) {
    color = value <= thresholds[1] ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : value <= thresholds[0] ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'bg-destructive/10 text-destructive';
  } else {
    color = value >= thresholds[1] ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : value >= thresholds[0] ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'bg-destructive/10 text-destructive';
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{value}%</span>;
}

function SummaryCard({ label, value, accent, negative, desc }: { label: string; value: string; accent?: boolean; negative?: boolean; desc?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-3 shadow-sm ${accent ? 'ring-1 ring-primary/20' : ''}`}>
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className={`text-lg font-bold truncate ${accent ? 'text-primary' : negative ? 'text-destructive' : 'text-card-foreground'}`}>{value}</p>
      {desc && <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>}
    </div>
  );
}
