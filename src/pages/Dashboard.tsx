import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { StatsCard } from '@/components/StatsCard';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetDashboardStats, apiGetOrderStats, apiGetAgents } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Clock, PhoneCall, PhoneForwarded, CheckCircle2, Truck, RotateCcw,
  DollarSign, Trash2, XCircle, BarChart3, Users, Loader2, TrendingUp,
  FileText, Target, Download, CalendarDays, UserCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const statusIcons: Record<OrderStatus, any> = {
  pending: Clock, take: PhoneCall, call_again: PhoneForwarded,
  confirmed: CheckCircle2, shipped: Truck, returned: RotateCcw,
  paid: DollarSign, trashed: Trash2, cancelled: XCircle,
};

const PIE_COLORS = [
  'hsl(27, 95%, 48%)', 'hsl(142, 76%, 36%)', 'hsl(217, 91%, 60%)',
  'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)',
  'hsl(180, 70%, 40%)', 'hsl(340, 82%, 52%)', 'hsl(45, 93%, 47%)',
];

interface DashStats {
  lead_count: number; deals_won: number; deals_lost: number;
  total_value: number; tasks_completed: number; total_orders: number;
  daily: Record<string, { leads: number; deals_won: number; deals_lost: number; orders: number; calls: number }>;
  statusCounts: Record<string, number>;
  personalMetrics?: DashStats | null;
  isDualRole?: boolean;
}

function exportCSV(data: DashStats, period: string, label?: string) {
  const rows = [
    ['Metric', 'Value'],
    ['Period', period],
    ...(label ? [['Section', label]] : []),
    ['Leads Created', String(data.lead_count)],
    ['Deals Won', String(data.deals_won)],
    ['Deals Lost', String(data.deals_lost)],
    ['Total Value', String(data.total_value)],
    ['Calls Completed', String(data.tasks_completed)],
    ['Total Orders', String(data.total_orders)],
    ['', ''],
    ['Status', 'Count'],
    ...Object.entries(data.statusCounts).map(([s, c]) => [s, String(c)]),
    ['', ''],
    ['Date', 'Leads', 'Deals Won', 'Deals Lost', 'Orders', 'Calls'],
    ...Object.entries(data.daily).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) =>
      [d, String(v.leads), String(v.deals_won), String(v.deals_lost), String(v.orders), String(v.calls)]
    ),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `dashboard-${label || 'stats'}-${period}-${new Date().toISOString().substring(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function PeriodCard({ title, data, icon: Icon, onExport }: { title: string; data: DashStats | undefined; icon: any; onExport: () => void }) {
  if (!data) return (
    <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>
  );
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4" />{title}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExport} title="Export CSV">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{data.lead_count}</p>
          <p className="text-[11px] text-muted-foreground">Leads</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-success">{data.deals_won}</p>
          <p className="text-[11px] text-muted-foreground">Won</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-destructive">{data.deals_lost}</p>
          <p className="text-[11px] text-muted-foreground">Lost</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">${data.total_value.toLocaleString()}</p>
          <p className="text-[11px] text-muted-foreground">Value</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-info">{data.tasks_completed}</p>
          <p className="text-[11px] text-muted-foreground">Calls</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;
  const isDualRole = user?.isAdmin && user?.isAgent;
  const [agentFilter, setAgentFilter] = useState('all');

  const effectiveAgent = agentFilter !== 'all' ? agentFilter : undefined;

  const { data: todayStats } = useQuery<DashStats>({
    queryKey: ['dashboard-stats', 'today', effectiveAgent],
    queryFn: () => apiGetDashboardStats({ period: 'today', agent_id: effectiveAgent }),
    refetchInterval: 30000,
  });

  const { data: yesterdayStats } = useQuery<DashStats>({
    queryKey: ['dashboard-stats', 'yesterday', effectiveAgent],
    queryFn: () => apiGetDashboardStats({ period: 'yesterday', agent_id: effectiveAgent }),
  });

  const { data: monthStats } = useQuery<DashStats>({
    queryKey: ['dashboard-stats', 'month', effectiveAgent],
    queryFn: () => apiGetDashboardStats({ period: 'month', agent_id: effectiveAgent }),
    refetchInterval: 60000,
  });

  const { data: orderStats } = useQuery({
    queryKey: ['order-stats'],
    queryFn: () => apiGetOrderStats(),
  });

  const { data: agents = [] } = useQuery<{ user_id: string; full_name: string }[]>({
    queryKey: ['agents'],
    queryFn: apiGetAgents,
    enabled: !!isAdmin,
  });

  const statusCounts = orderStats?.statusCounts || {};
  const agentCounts = orderStats?.agentCounts || {};
  const dailyCounts = orderStats?.dailyCounts || {};

  const chartData = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, orders]) => ({
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      orders: orders as number,
    }));

  const agentStats = Object.entries(agentCounts).map(([name, count]) => ({ name, count: count as number }));

  const trendData = monthStats ? Object.entries(monthStats.daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      leads: v.leads, won: v.deals_won, lost: v.deals_lost, calls: v.calls,
    })) : [];

  const pieData = monthStats ? Object.entries(monthStats.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: STATUS_LABELS[name as OrderStatus] || name, value })) : [];

  // Personal metrics for dual-role users
  const personalToday = todayStats?.personalMetrics;
  const personalYesterday = yesterdayStats?.personalMetrics;
  const personalMonth = monthStats?.personalMetrics;

  return (
    <AppLayout title="Dashboard">
      {/* Admin filter */}
      {isAdmin && (
        <div className="mb-4 flex items-center gap-3">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {agentFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setAgentFilter('all')}>Clear</Button>
          )}
        </div>
      )}

      {/* Admin metrics section */}
      {isAdmin && (
        <>
          {isDualRole && (
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Team Overview</h2>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <PeriodCard title="Today" data={todayStats} icon={CalendarDays} onExport={() => todayStats && exportCSV(todayStats, 'today', 'team')} />
            <PeriodCard title="Yesterday" data={yesterdayStats} icon={Clock} onExport={() => yesterdayStats && exportCSV(yesterdayStats, 'yesterday', 'team')} />
            <PeriodCard title="This Month" data={monthStats} icon={Target} onExport={() => monthStats && exportCSV(monthStats, 'month', 'team')} />
          </div>
        </>
      )}

      {/* Personal metrics for dual-role users */}
      {isDualRole && agentFilter === 'all' && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">My Personal Stats</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <PeriodCard title="My Today" data={personalToday || undefined} icon={CalendarDays} onExport={() => personalToday && exportCSV(personalToday, 'today', 'personal')} />
            <PeriodCard title="My Yesterday" data={personalYesterday || undefined} icon={Clock} onExport={() => personalYesterday && exportCSV(personalYesterday, 'yesterday', 'personal')} />
            <PeriodCard title="My Month" data={personalMonth || undefined} icon={Target} onExport={() => personalMonth && exportCSV(personalMonth, 'month', 'personal')} />
          </div>
        </>
      )}

      {/* Agent-only stats (non-admin agents) */}
      {!isAdmin && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <PeriodCard title="Today" data={todayStats} icon={CalendarDays} onExport={() => todayStats && exportCSV(todayStats, 'today', 'personal')} />
          <PeriodCard title="Yesterday" data={yesterdayStats} icon={Clock} onExport={() => yesterdayStats && exportCSV(yesterdayStats, 'yesterday', 'personal')} />
          <PeriodCard title="This Month" data={monthStats} icon={Target} onExport={() => monthStats && exportCSV(monthStats, 'month', 'personal')} />
        </div>
      )}

      {/* Status counters */}
      <div className="grid grid-cols-3 gap-4 lg:grid-cols-5 xl:grid-cols-9 mb-6">
        {ALL_STATUSES.map(status => (
          <StatsCard
            key={status}
            title={STATUS_LABELS[status]}
            value={statusCounts[status] || 0}
            icon={statusIcons[status]}
          />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="col-span-2 rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Orders per Day</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
              <Bar dataKey="orders" fill="hsl(27, 95%, 48%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Agent Assignments</h2>
          </div>
          <div className="space-y-3">
            {agentStats.length === 0 && <p className="text-sm text-muted-foreground">No assignments yet.</p>}
            {agentStats.map(agent => (
              <div key={agent.name} className="flex items-center justify-between rounded-lg bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {agent.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{agent.name}</span>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{agent.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trends + pie chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Monthly Trends</h2>
          </div>
          {trendData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data for this month yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
                <Legend />
                <Line type="monotone" dataKey="leads" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="won" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lost" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="calls" stroke="hsl(27, 95%, 48%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Order Status (Month)</h2>
          </div>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No orders this month</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
