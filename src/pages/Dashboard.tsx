import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetDashboardStats, apiGetOrderStats, apiGetAgents, apiGetProducts, apiGetRecentActivity } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  Clock, CheckCircle2, Truck, Package, Users, Loader2, TrendingUp, TrendingDown,
  Target, Download, CalendarDays, ShoppingCart, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart as PieChartIcon, Activity, Warehouse, UserCheck, Percent,
  CalendarIcon, X, MessageSquare, Phone, ArrowRightLeft, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart,
} from 'recharts';

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
  orders_from_standard?: number;
  orders_from_leads?: number;
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

// Metric card component
function MetricCard({ title, value, icon: Icon, trend, trendLabel, color }: {
  title: string; value: string | number; icon: any; trend?: number; trendLabel?: string; color: string;
}) {
  const isPositive = trend !== undefined && trend >= 0;
  return (
    <Card className="relative overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-card-foreground">{value}</p>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(trend)}% {trendLabel || 'vs yesterday'}
              </div>
            )}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Time ago helper
function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Tooltip for recharts
const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;
  const isDualRole = user?.isAdmin && user?.isAgent;
  const [agentFilter, setAgentFilter] = useState('all');
  const [chartView, setChartView] = useState<'orders' | 'revenue' | 'leads'>('orders');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

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

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn: apiGetProducts,
    enabled: !!isAdmin,
  });

  const { data: recentActivity = [] } = useQuery<any[]>({
    queryKey: ['recent-activity'],
    queryFn: () => apiGetRecentActivity(25),
    refetchInterval: 30000,
  });

  const statusCounts = orderStats?.statusCounts || {};
  const agentCounts = orderStats?.agentCounts || {};
  const dailyCounts = orderStats?.dailyCounts || {};

  // Computed metrics
  const totalOrders = todayStats?.total_orders || 0;
  const confirmedLeads = todayStats?.deals_won || 0;
  const shippedOrders = statusCounts['shipped'] || 0;
  const pendingOrders = statusCounts['pending'] || 0;
  const activeAgents = agents.length;
  const conversionRate = todayStats && todayStats.lead_count > 0
    ? Math.round((todayStats.deals_won / todayStats.lead_count) * 100)
    : 0;

  // Trends vs yesterday
  const orderTrend = todayStats && yesterdayStats && yesterdayStats.total_orders > 0
    ? Math.round(((todayStats.total_orders - yesterdayStats.total_orders) / yesterdayStats.total_orders) * 100)
    : undefined;
  const leadTrend = todayStats && yesterdayStats && yesterdayStats.deals_won > 0
    ? Math.round(((todayStats.deals_won - yesterdayStats.deals_won) / yesterdayStats.deals_won) * 100)
    : undefined;

  // Stock levels
  const lowStock = products.filter((p: any) => p.stock_quantity <= p.low_stock_threshold).length;
  const medStock = products.filter((p: any) => p.stock_quantity > p.low_stock_threshold && p.stock_quantity <= p.low_stock_threshold * 3).length;
  const highStock = products.filter((p: any) => p.stock_quantity > p.low_stock_threshold * 3).length;

  // Chart data
  const chartData = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, orders]) => ({
      name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      orders: orders as number,
    }));

  const agentStats = Object.entries(agentCounts)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count);

  const trendData = monthStats ? Object.entries(monthStats.daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      leads: v.leads, won: v.deals_won, lost: v.deals_lost, calls: v.calls, orders: v.orders,
    })) : [];

  const pieData = monthStats ? Object.entries(monthStats.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: STATUS_LABELS[name as OrderStatus] || name, value })) : [];

  const totalPieValue = pieData.reduce((sum, d) => sum + d.value, 0);

  // Personal metrics for dual-role users
  const personalToday = todayStats?.personalMetrics;

  const hasActiveFilters = agentFilter !== 'all' || dateFrom || dateTo;

  return (
    <AppLayout title="Dashboard">
      {/* Filter bar */}
      {isAdmin && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 backdrop-blur-sm p-3">
          <div className="flex items-center gap-2">
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-48 h-9 text-sm rounded-lg">
                <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-lg text-sm gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 rounded-lg text-sm gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'MMM d') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setAgentFilter('all'); setDateFrom(undefined); setDateTo(undefined); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}

          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-9 rounded-lg text-sm gap-1.5"
              onClick={() => monthStats && exportCSV(monthStats, 'month', 'dashboard')}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 mb-6">
        <MetricCard title="Total Orders" value={totalOrders} icon={ShoppingCart}
          trend={orderTrend} color="bg-primary" />
        <MetricCard title="Confirmed Leads" value={confirmedLeads} icon={CheckCircle2}
          trend={leadTrend} color="bg-[hsl(var(--success))]" />
        <MetricCard title="Shipped" value={shippedOrders} icon={Truck}
          color="bg-[hsl(var(--info))]" />
        <MetricCard title="Pending" value={pendingOrders} icon={Clock}
          color="bg-[hsl(var(--warning))]" />
        <MetricCard title="Low Stock" value={lowStock} icon={Warehouse}
          color={lowStock > 0 ? 'bg-destructive' : 'bg-muted'} />
        <MetricCard title="Active Agents" value={activeAgents} icon={UserCheck}
          color="bg-[hsl(262,83%,58%)]" />
        <MetricCard title="Conversion" value={`${conversionRate}%`} icon={Percent}
          color="bg-[hsl(180,70%,40%)]" />
      </div>

      {/* Dual role personal stats strip */}
      {isDualRole && agentFilter === 'all' && personalToday && (
        <Card className="mb-6 border-none shadow-sm bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="flex items-center gap-6 py-3 px-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-card-foreground">My Stats Today</span>
            </div>
            <div className="flex gap-6 text-sm">
              <span><strong className="text-card-foreground">{personalToday.total_orders}</strong> <span className="text-muted-foreground">orders</span></span>
              <span><strong className="text-[hsl(var(--success))]">{personalToday.deals_won}</strong> <span className="text-muted-foreground">won</span></span>
              <span><strong className="text-destructive">{personalToday.deals_lost}</strong> <span className="text-muted-foreground">lost</span></span>
              <span><strong className="text-[hsl(var(--info))]">{personalToday.tasks_completed}</strong> <span className="text-muted-foreground">calls</span></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Over Time + Status Distribution */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Sales & Orders Over Time
            </CardTitle>
            <Tabs value={chartView} onValueChange={v => setChartView(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="orders" className="text-xs px-3 h-7">Orders</TabsTrigger>
                <TabsTrigger value="leads" className="text-xs px-3 h-7">Leads</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs px-3 h-7">Revenue</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-2">
            {trendData.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(27, 95%, 48%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(27, 95%, 48%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradWon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  {chartView === 'orders' && (
                    <Area type="monotone" dataKey="orders" stroke="hsl(27, 95%, 48%)" strokeWidth={2} fill="url(#gradOrders)" />
                  )}
                  {chartView === 'leads' && (
                    <>
                      <Area type="monotone" dataKey="leads" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#gradLeads)" />
                      <Area type="monotone" dataKey="won" stroke="hsl(142, 76%, 36%)" strokeWidth={2} fill="url(#gradWon)" />
                    </>
                  )}
                  {chartView === 'revenue' && (
                    <Area type="monotone" dataKey="calls" stroke="hsl(262, 83%, 58%)" strokeWidth={2} fill="none" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut chart - Status Distribution */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">No orders this month</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Mini legend */}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {pieData.slice(0, 5).map((d, i) => (
                <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance + Stock Levels */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Agent Leaderboard */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Team Performance
            </CardTitle>
            <span className="text-xs text-muted-foreground">{agentStats.length} agents</span>
          </CardHeader>
          <CardContent>
            {agentStats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No assignments yet</p>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {agentStats.map((agent, idx) => {
                  const maxCount = agentStats[0]?.count || 1;
                  const pct = Math.round((agent.count / maxCount) * 100);
                  return (
                    <div key={agent.name} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground text-right">#{idx + 1}</span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                        {agent.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{agent.name}</span>
                          <span className="text-xs font-bold text-primary ml-2">{agent.count}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/70 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Levels */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Warehouse Stock Levels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { label: 'Low Stock', count: lowStock, color: 'bg-destructive', textColor: 'text-destructive' },
                { label: 'Medium Stock', count: medStock, color: 'bg-[hsl(var(--warning))]', textColor: 'text-[hsl(var(--warning))]' },
                { label: 'High Stock', count: highStock, color: 'bg-[hsl(var(--success))]', textColor: 'text-[hsl(var(--success))]' },
              ].map(level => (
                <div key={level.label} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${level.color}`} />
                    <span className="text-sm font-medium">{level.label}</span>
                  </div>
                  <span className={`text-lg font-bold ${level.textColor}`}>{level.count}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Products</span>
                <span className="text-sm font-bold">{products.length}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                {products.length > 0 && (
                  <>
                    <div className="h-full bg-destructive transition-all" style={{ width: `${(lowStock / products.length) * 100}%` }} />
                    <div className="h-full bg-[hsl(var(--warning))] transition-all" style={{ width: `${(medStock / products.length) * 100}%` }} />
                    <div className="h-full bg-[hsl(var(--success))] transition-all" style={{ width: `${(highStock / products.length) * 100}%` }} />
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders per Day bar chart */}
      <Card className="border-none shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Orders per Day (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                <Bar dataKey="orders" fill="hsl(27, 95%, 48%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity + Status Counters */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Activity Feed */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
            <span className="text-xs text-muted-foreground">{recentActivity.length} events</span>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No recent activity</p>
            ) : (
              <ScrollArea className="h-[360px] pr-3">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-1">
                    {recentActivity.map((item: any) => {
                      const isCall = item.type === 'call';
                      const isNote = item.type === 'note';
                      const isStatus = item.type === 'status_change';
                      const icon = isCall ? Phone : isNote ? MessageSquare : ArrowRightLeft;
                      const IconComp = icon;
                      const iconBg = isCall
                        ? 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]'
                        : isNote
                        ? 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]'
                        : 'bg-primary/10 text-primary';

                      const timeAgo = getTimeAgo(item.timestamp);

                      return (
                        <div key={item.id} className="flex gap-3 py-2.5 pl-0 relative group">
                          <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-full shrink-0 z-10 ${iconBg}`}>
                            <IconComp className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-card-foreground">{item.actor}</span>
                              {isStatus && item.metadata?.to && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  item.metadata.to === 'confirmed' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' :
                                  item.metadata.to === 'shipped' ? 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]' :
                                  item.metadata.to === 'cancelled' || item.metadata.to === 'trashed' ? 'bg-destructive/15 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {STATUS_LABELS[item.metadata.to as OrderStatus] || item.metadata.to}
                                </span>
                              )}
                              {isCall && item.metadata?.outcome && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  item.metadata.outcome === 'confirmed' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' :
                                  item.metadata.outcome === 'no_answer' ? 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {item.metadata.outcome}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">{timeAgo}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Status Counters - vertical */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Order Statuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ALL_STATUSES.map(status => {
                const count = Number(statusCounts[status] || 0);
                const total = (Object.values(statusCounts) as number[]).reduce((s, v) => s + v, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-20 truncate">{STATUS_LABELS[status]}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-card-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
