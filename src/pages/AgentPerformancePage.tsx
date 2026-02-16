import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Search, TrendingUp, Package, DollarSign } from 'lucide-react';
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
  const header = 'Agent Name,Email,Total Shipped,Total Earned,Avg Order Value';
  const rows = data.map(a => `"${a.full_name}","${a.email}",${a.total_shipped},${a.total_earned.toFixed(2)},${a.avg_order_value.toFixed(2)}`);
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

  const totals = useMemo(() => ({
    shipped: data.reduce((s, a) => s + a.total_shipped, 0),
    earned: data.reduce((s, a) => s + a.total_earned, 0),
  }), [data]);

  return (
    <AppLayout title="Performance">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={<Package className="h-5 w-5" />} label="Total Shipped" value={String(totals.shipped)} />
        <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Total Earned" value={totals.earned.toFixed(2)} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="Agents" value={String(data.length)} />
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
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Shipped</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Earned</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Order Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map((agent, i) => (
                  <tr key={agent.user_id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {agent.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">{agent.full_name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{agent.total_shipped}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{agent.total_earned.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{agent.avg_order_value.toFixed(2)}</td>
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

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-card-foreground">{value}</p>
      </div>
    </div>
  );
}
