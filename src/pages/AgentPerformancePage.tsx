import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Search, TrendingUp, DollarSign, Users, Target, BarChart3, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiGetAgents } from '@/lib/api';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

interface FetchParams {
  from?: string; to?: string; search?: string;
  source?: string; status?: string; agent_id?: string;
  include_cancelled?: boolean; show_zero?: boolean;
}

async function fetchPerformance(params: FetchParams) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  const sp = new URLSearchParams();
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.search) sp.set('search', params.search);
  if (params.source) sp.set('source', params.source);
  if (params.status) sp.set('status', params.status);
  if (params.agent_id) sp.set('agent_id', params.agent_id);
  if (params.include_cancelled) sp.set('include_cancelled', 'true');
  if (params.show_zero) sp.set('show_zero', 'true');
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

const fmt = (n: number | undefined | null) => { const v = n ?? 0; return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(2); };

function exportCSV(data: AgentPerf[]) {
  const header = 'Agent,Leads,Confirmed,Shipped,Paid,Returned,Cancelled,Conv%,Ship%,Collect%,Ret%,Gross Rev,Paid Rev,Outstanding,Returned Val,Profit,AOV,Rev/Lead,Profit/Lead';
  const rows = data.map(a =>
    `"${a.full_name}",${a.leads_assigned},${a.total_confirmed},${a.total_shipped},${a.total_paid},${a.total_returned},${a.total_cancelled},${a.conversion_rate},${a.shipment_rate},${a.collection_rate},${a.return_rate},${(a.gross_revenue ?? 0).toFixed(2)},${(a.paid_revenue ?? 0).toFixed(2)},${(a.outstanding_revenue ?? 0).toFixed(2)},${(a.returned_value ?? 0).toFixed(2)},${(a.total_profit ?? 0).toFixed(2)},${(a.avg_order_value ?? 0).toFixed(2)},${(a.revenue_per_lead ?? 0).toFixed(2)},${(a.profit_per_lead ?? 0).toFixed(2)}`
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
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [showZero, setShowZero] = useState(false);

  const { data: agents = [] } = useQuery<{ user_id: string; full_name: string }[]>({
    queryKey: ['agents'],
    queryFn: apiGetAgents,
  });

  const buildParams = (preset: FilterPreset, cFrom?: string, cTo?: string): FetchParams => {
    let range = getDateRange(preset);
    if (preset === 'custom' && cFrom && cTo) range = { from: cFrom, to: cTo };
    return {
      from: range?.from,
      to: range?.to,
      search: search || undefined,
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      agent_id: agentFilter !== 'all' ? agentFilter : undefined,
      include_cancelled: includeCancelled,
      show_zero: showZero,
    };
  };

  const loadData = (preset?: FilterPreset, cFrom?: string, cTo?: string) => {
    setLoading(true);
    const p = preset ?? filter;
    fetchPerformance(buildParams(p, cFrom, cTo))
      .then(setData)
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleFilterChange = (preset: FilterPreset) => {
    setFilter(preset);
    if (preset !== 'custom') loadData(preset);
  };

  const applyFilters = () => loadData(filter, customFrom, customTo);

  const clearFilters = () => {
    setSourceFilter('all');
    setStatusFilter('all');
    setAgentFilter('all');
    setIncludeCancelled(false);
    setShowZero(false);
    setSearch('');
    // reload with defaults
    setTimeout(() => loadData(filter), 0);
  };

  const hasActiveFilters = sourceFilter !== 'all' || statusFilter !== 'all' || agentFilter !== 'all' || includeCancelled || showZero || search;

  const totals = useMemo(() => {
    const s = (key: keyof AgentPerf) => data.reduce((sum, a) => sum + (Number(a[key]) || 0), 0);
    const leads = s('leads_assigned');
    const confirmed = s('total_confirmed');
    const shipped = s('total_shipped');
    const paid = s('total_paid');
    const returned = s('total_returned');
    const cancelled = s('total_cancelled');
    const grossRevenue = s('gross_revenue');
    const paidRevenue = s('paid_revenue');
    const outstanding = s('outstanding_revenue');
    const returnedValue = s('returned_value');
    const profit = s('total_profit');
    const convRate = leads > 0 ? Math.round((confirmed / leads) * 10000) / 100 : 0;
    const shipRate = confirmed > 0 ? Math.round((shipped / confirmed) * 10000) / 100 : 0;
    const collectRate = shipped > 0 ? Math.round((paid / shipped) * 10000) / 100 : 0;
    const retRate = shipped > 0 ? Math.round((returned / shipped) * 10000) / 100 : 0;
    const aov = paid > 0 ? Math.round((paidRevenue / paid) * 100) / 100 : 0;
    return { leads, confirmed, shipped, paid, returned, cancelled, grossRevenue, paidRevenue, outstanding, returnedValue, profit, convRate, shipRate, collectRate, retRate, aov };
  }, [data]);

  return (
    <AppLayout title="Performance">
      {/* === FILTERS === */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 backdrop-blur-sm p-3">
        {/* Date presets */}
        <div className="flex items-center gap-1">
          {(['today', 'week', 'month', 'custom'] as FilterPreset[]).map(p => (
            <Button key={p} variant={filter === p ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => handleFilterChange(p)}>
              {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom'}
            </Button>
          ))}
        </div>

        {filter === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-auto text-xs" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-auto text-xs" />
          </div>
        )}

        {/* Agent */}
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Source */}
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="prediction">Prediction</SelectItem>
            <SelectItem value="inbound_lead">Webhook</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>

        {/* Toggles */}
        <div className="flex items-center gap-2">
          <Switch id="incCanc" checked={includeCancelled} onCheckedChange={setIncludeCancelled} className="scale-75" />
          <Label htmlFor="incCanc" className="text-xs text-muted-foreground cursor-pointer">Cancelled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="showZero" checked={showZero} onCheckedChange={setShowZero} className="scale-75" />
          <Label htmlFor="showZero" className="text-xs text-muted-foreground cursor-pointer">Show 0</Label>
        </div>

        {/* Apply / Clear */}
        <Button size="sm" className="h-8 text-xs" onClick={applyFilters}>Apply</Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}

        {/* Search + Export */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search agent..." value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()} className="h-8 pl-7 w-40 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportCSV(data)} disabled={data.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>

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
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Leads</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Conf.</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ship.</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ret.</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Conv%</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Coll%</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground">Ret%</th>
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
                      <RateBadge value={a.conversion_rate ?? 0} thresholds={[25, 50]} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <RateBadge value={a.collection_rate ?? 0} thresholds={[40, 70]} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <RateBadge value={a.return_rate ?? 0} thresholds={[15, 5]} invert />
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
