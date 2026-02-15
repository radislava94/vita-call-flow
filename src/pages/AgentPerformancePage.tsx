import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Users, ShoppingCart, FileSpreadsheet, Clock, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

async function fetchPerformance(from?: string, to?: string) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  const sp = new URLSearchParams();
  if (from) sp.set('from', from);
  if (to) sp.set('to', to);
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

type FilterPreset = 'today' | 'week' | 'month' | 'custom';

function getDateRange(preset: FilterPreset): { from: string; to: string } | null {
  const now = new Date();
  const toStr = new Date(now.getTime() + 86400000).toISOString().substring(0, 10);
  if (preset === 'today') {
    return { from: now.toISOString().substring(0, 10), to: toStr };
  }
  if (preset === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return { from: weekAgo.toISOString().substring(0, 10), to: toStr };
  }
  if (preset === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    return { from: monthAgo.toISOString().substring(0, 10), to: toStr };
  }
  return null;
}

interface AgentPerf {
  user_id: string;
  full_name: string;
  email: string;
  total_orders: number;
  confirmed_orders: number;
  returned_orders: number;
  total_leads: number;
  leads_contacted_today: number;
  conversion_rate: number;
  avg_time_minutes: number | null;
}

export default function AgentPerformancePage() {
  const { toast } = useToast();
  const [data, setData] = useState<AgentPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterPreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadData = (preset: FilterPreset, cFrom?: string, cTo?: string) => {
    setLoading(true);
    let range = getDateRange(preset);
    if (preset === 'custom' && cFrom && cTo) {
      range = { from: cFrom, to: cTo };
    }
    fetchPerformance(range?.from, range?.to)
      .then(setData)
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(filter); }, []);

  const handleFilterChange = (preset: FilterPreset) => {
    setFilter(preset);
    if (preset !== 'custom') loadData(preset);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) loadData('custom', customFrom, customTo);
  };

  const formatAvgTime = (minutes: number | null) => {
    if (minutes === null) return '—';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <AppLayout title="Agent Performance">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['today', 'week', 'month', 'custom'] as FilterPreset[]).map(p => (
          <Button
            key={p}
            variant={filter === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange(p)}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
          </Button>
        ))}
        {filter === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-auto" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-auto" />
            <Button size="sm" onClick={handleCustomApply}>Apply</Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No agents found.
        </div>
      ) : (
        <div className="space-y-4">
          {data.map(agent => (
            <div key={agent.user_id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {agent.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">{agent.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
                    <Percent className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-semibold text-primary">{agent.conversion_rate}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-px bg-border">
                <StatCell
                  icon={<ShoppingCart className="h-4 w-4" />}
                  label="Assigned Orders"
                  value={agent.total_orders}
                />
                <StatCell
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Confirmed"
                  value={agent.confirmed_orders}
                  highlight="success"
                />
                <StatCell
                  icon={<ShoppingCart className="h-4 w-4" />}
                  label="Returned"
                  value={agent.returned_orders}
                  highlight="destructive"
                />
                <StatCell
                  icon={<FileSpreadsheet className="h-4 w-4" />}
                  label="Total Leads"
                  value={agent.total_leads}
                />
                <StatCell
                  icon={<Users className="h-4 w-4" />}
                  label="Contacted Today"
                  value={agent.leads_contacted_today}
                />
                <StatCell
                  icon={<Percent className="h-4 w-4" />}
                  label="Conversion"
                  value={`${agent.conversion_rate}%`}
                  highlight="primary"
                />
                <StatCell
                  icon={<Clock className="h-4 w-4" />}
                  label="Avg Response"
                  value={formatAvgTime(agent.avg_time_minutes)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function StatCell({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: 'success' | 'destructive' | 'primary';
}) {
  return (
    <div className="bg-card px-4 py-3 flex flex-col items-center text-center gap-1">
      <div className={cn(
        'text-muted-foreground',
        highlight === 'success' && 'text-primary',
        highlight === 'destructive' && 'text-destructive',
        highlight === 'primary' && 'text-primary',
      )}>{icon}</div>
      <span className={cn(
        'text-lg font-bold',
        highlight === 'success' && 'text-primary',
        highlight === 'destructive' && 'text-destructive',
        highlight === 'primary' && 'text-primary',
      )}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
