import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCeoDashboardStats, apiGetDashboardStats, apiGetOrderStats, apiGetAgents, apiGetProducts, apiGetRecentActivity } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  Clock, CheckCircle2, Truck, Package, Users, TrendingUp, TrendingDown,
  Target, Download, CalendarDays, ShoppingCart, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart as PieChartIcon, Activity, Warehouse, UserCheck, Percent,
  CalendarIcon, X, MessageSquare, Phone, ArrowRightLeft, FileText,
  DollarSign, AlertTriangle, Trophy, Zap, Shield, ChevronRight,
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
function MetricCard({ title, value, icon: Icon, trend, trendLabel, color, subtitle }: {
  title: string; value: string | number; icon: any; trend?: number; trendLabel?: string; color: string; subtitle?: string;
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
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(2);
const fmtCurrency = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(2);

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;
  const isDualRole = user?.isAdmin && user?.isAgent;
  const [agentFilter, setAgentFilter] = useState('all');
  const [chartView, setChartView] = useState<'revenue' | 'orders' | 'leads'>('revenue');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const effectiveAgent = agentFilter !== 'all' ? agentFilter : undefined;

  // CEO stats
  const { data: ceoStats } = useQuery<any>({
    queryKey: ['ceo-dashboard-stats', effectiveAgent, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: () => apiGetCeoDashboardStats({
      period: (dateFrom && dateTo) ? 'custom' : 'month',
      agent_id: effectiveAgent,
      from: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
      to: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
    }),
    refetchInterval: 60000,
    enabled: !!isAdmin,
  });

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

  const totalOrders = todayStats?.total_orders || 0;
  const confirmedLeads = todayStats?.deals_won || 0;

  const orderTrend = todayStats && yesterdayStats && yesterdayStats.total_orders > 0
    ? Math.round(((todayStats.total_orders - yesterdayStats.total_orders) / yesterdayStats.total_orders) * 100)
    : undefined;
  const leadTrend = todayStats && yesterdayStats && yesterdayStats.deals_won > 0
    ? Math.round(((todayStats.deals_won - yesterdayStats.deals_won) / yesterdayStats.deals_won) * 100)
    : undefined;

  const lowStock = products.filter((p: any) => p.stock_quantity <= p.low_stock_threshold).length;
  const medStock = products.filter((p: any) => p.stock_quantity > p.low_stock_threshold && p.stock_quantity <= p.low_stock_threshold * 3).length;
  const highStock = products.filter((p: any) => p.stock_quantity > p.low_stock_threshold * 3).length;

  const personalToday = todayStats?.personalMetrics;

  // Revenue trend chart data from CEO stats
  const revenueTrendData = useMemo(() => {
    if (!ceoStats?.dailyRevenue) return [];
    return Object.entries(ceoStats.dailyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]: [string, any]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: v.revenue,
        orders: v.orders,
        leads: v.leads,
      }));
  }, [ceoStats?.dailyRevenue]);

  const pieData = monthStats ? Object.entries(monthStats.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: STATUS_LABELS[name as OrderStatus] || name, value })) : [];

  const hasActiveFilters = agentFilter !== 'all' || dateFrom || dateTo;

  const funnel = ceoStats?.funnel;
  const topAgent = ceoStats?.topAgent;
  const alerts = ceoStats?.alerts || [];
  const snap = ceoStats?.todaySnapshot;
  const agentRankings = ceoStats?.agentRankings || [];

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

      {/* === 1. TOP FINANCIAL ROW === */}
      {isAdmin && ceoStats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-6">
          <MetricCard title="Revenue" value={fmtCurrency(ceoStats.revenue || 0)} icon={DollarSign}
            color="bg-[hsl(var(--success))]" subtitle="Confirmed + Delivered + Paid" />
          <MetricCard title="Paid" value={`${ceoStats.paidCount || 0} / ${fmtCurrency(ceoStats.paidAmount || 0)}`} icon={CheckCircle2}
            color="bg-primary" subtitle="Paid orders count & total" />
          <MetricCard title="Outstanding" value={fmtCurrency(ceoStats.outstanding || 0)} icon={Clock}
            color="bg-[hsl(var(--warning))]" subtitle="Confirmed + Delivered" />
          <MetricCard title="Profit" value={fmtCurrency(ceoStats.profit || 0)} icon={TrendingUp}
            color="bg-[hsl(var(--info))]" subtitle="Paid revenue - cost" />
          <MetricCard title="Total Orders" value={totalOrders} icon={ShoppingCart}
            trend={orderTrend} color="bg-muted" />
        </div>
      )}

      {/* === 6. DAILY SNAPSHOT STRIP === */}
      {isAdmin && snap && (
        <Card className="mb-6 border-none shadow-sm bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="flex flex-wrap items-center gap-6 py-3 px-5">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-card-foreground">Today's Snapshot</span>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <span><strong className="text-card-foreground">{snap.taken}</strong> <span className="text-muted-foreground">Taken</span></span>
              <span><strong className="text-[hsl(var(--success))]">{snap.confirmed}</strong> <span className="text-muted-foreground">Confirmed</span></span>
              <span><strong className="text-primary">{snap.paid}</strong> <span className="text-muted-foreground">Paid</span></span>
              <span><strong className="text-[hsl(var(--success))]">{fmtCurrency(snap.revenue)}</strong> <span className="text-muted-foreground">Revenue</span></span>
              <span><strong className="text-destructive">{snap.returns}</strong> <span className="text-muted-foreground">Returns</span></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dual role personal stats strip */}
      {isDualRole && agentFilter === 'all' && personalToday && (
        <Card className="mb-6 border-none shadow-sm bg-gradient-to-r from-[hsl(var(--info))]/5 to-transparent">
          <CardContent className="flex items-center gap-6 py-3 px-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[hsl(var(--info))]" />
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

      {/* === 2. FUNNEL PERFORMANCE === */}
      {isAdmin && funnel && (
        <Card className="mb-6 border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Funnel Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
              {[
                { label: 'Taken', count: funnel.allTaken, pct: null, color: 'bg-[hsl(var(--info))]' },
                { label: 'Confirmed', count: funnel.confirmed, pct: funnel.confirmationRate, color: 'bg-[hsl(var(--warning))]' },
                { label: 'Paid', count: funnel.paid, pct: funnel.conversionRate, color: 'bg-[hsl(var(--success))]' },
                { label: 'Shipped', count: funnel.shipped, pct: null, color: 'bg-primary' },
                { label: 'Returned', count: funnel.returned, pct: funnel.returnRate, color: 'bg-destructive' },
              ].map((stage, idx, arr) => (
                <div key={stage.label} className="flex items-center gap-2 flex-1 min-w-[100px]">
                  <div className="flex-1 text-center">
                    <div className={`mx-auto mb-1 h-12 w-12 rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg ${stage.color}`}>
                      {stage.count}
                    </div>
                    <p className="text-xs font-semibold text-card-foreground">{stage.label}</p>
                    {stage.pct !== null && (
                      <p className="text-[10px] text-muted-foreground">{stage.pct}%</p>
                    )}
                  </div>
                  {idx < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
              <span>Conversion: <strong className={`${funnel.conversionRate < 10 ? 'text-destructive' : 'text-[hsl(var(--success))]'}`}>{funnel.conversionRate}%</strong></span>
              <span>Confirmation: <strong className="text-card-foreground">{funnel.confirmationRate}%</strong></span>
              <span>Return: <strong className={`${funnel.returnRate > 20 ? 'text-destructive' : 'text-card-foreground'}`}>{funnel.returnRate}%</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === 3. REVENUE TREND + 4. TOP AGENT + 5. RISK ALERTS === */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Sales & Revenue Over Time
            </CardTitle>
            <Tabs value={chartView} onValueChange={v => setChartView(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="revenue" className="text-xs px-3 h-7">Revenue</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs px-3 h-7">Orders</TabsTrigger>
                <TabsTrigger value="leads" className="text-xs px-3 h-7">Leads</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-2">
            {revenueTrendData.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueTrendData}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(27, 95%, 48%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(27, 95%, 48%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  {chartView === 'revenue' && (
                    <Area type="monotone" dataKey="revenue" stroke="hsl(142, 76%, 36%)" strokeWidth={2} fill="url(#gradRevenue)" name="Revenue (Paid)" />
                  )}
                  {chartView === 'orders' && (
                    <Area type="monotone" dataKey="orders" stroke="hsl(27, 95%, 48%)" strokeWidth={2} fill="url(#gradOrders)" />
                  )}
                  {chartView === 'leads' && (
                    <Area type="monotone" dataKey="leads" stroke="hsl(217, 91%, 60%)" strokeWidth={2} fill="url(#gradLeads)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Right column: Top Agent + Alerts */}
        <div className="space-y-6">
          {/* Top Agent Widget */}
          {isAdmin && topAgent && (
            <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[hsl(var(--warning))]" />
                  Top Agent This Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                    {topAgent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-card-foreground">{topAgent.name}</p>
                    <p className="text-xs text-muted-foreground">#{1} by paid revenue</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-lg font-bold text-[hsl(var(--success))]">{fmtCurrency(topAgent.paidRevenue)}</p>
                    <p className="text-[10px] text-muted-foreground">Paid Revenue</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-lg font-bold text-primary">{topAgent.paidCount}</p>
                    <p className="text-[10px] text-muted-foreground">Paid Orders</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-lg font-bold text-card-foreground">{topAgent.conversionPct}%</p>
                    <p className="text-[10px] text-muted-foreground">Conversion</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className={`text-lg font-bold ${topAgent.returnPct > 20 ? 'text-destructive' : 'text-card-foreground'}`}>{topAgent.returnPct}%</p>
                    <p className="text-[10px] text-muted-foreground">Return Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk & Alert Panel */}
          {isAdmin && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  Risk & Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-[hsl(var(--success))]">
                    <CheckCircle2 className="h-4 w-4" />
                    All metrics healthy
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((a: any, i: number) => (
                      <div key={i} className={`flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                        a.level === 'red' ? 'bg-destructive/10 text-destructive' : 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]'
                      }`}>
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* === 7. AGENT RANKING TABLE + Status Distribution === */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Agent Ranking Table */}
        {isAdmin && (
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Agent Rankings (by Revenue)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {agentRankings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No agent data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 font-medium">#</th>
                        <th className="text-left py-2 font-medium">Agent</th>
                        <th className="text-right py-2 font-medium">Paid</th>
                        <th className="text-right py-2 font-medium">Revenue</th>
                        <th className="text-right py-2 font-medium">Conv %</th>
                        <th className="text-right py-2 font-medium">Ret %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentRankings.slice(0, 10).map((a: any, idx: number) => (
                        <tr key={a.name} className={`border-b last:border-0 ${idx === 0 ? 'bg-primary/5' : ''}`}>
                          <td className="py-2 text-xs font-bold text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 font-medium flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                              {a.name.charAt(0)}
                            </div>
                            <span className="truncate max-w-[120px]">{a.name}</span>
                            {idx === 0 && <Trophy className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />}
                          </td>
                          <td className="py-2 text-right font-bold">{a.paidCount}</td>
                          <td className="py-2 text-right font-bold text-[hsl(var(--success))]">{fmtCurrency(a.paidRevenue)}</td>
                          <td className="py-2 text-right">{a.conversionPct}%</td>
                          <td className={`py-2 text-right ${a.returnPct > 20 ? 'text-destructive font-bold' : ''}`}>{a.returnPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Distribution Donut */}
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

      {/* Stock Levels + Order Statuses */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Stock Levels */}
        {isAdmin && (
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
        )}

        {/* Recent Activity */}
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
              <ScrollArea className="h-[320px] pr-3">
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-1">
                    {recentActivity.map((item: any) => {
                      const isCall = item.type === 'call';
                      const isNote = item.type === 'note';
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
                              {item.type === 'status_change' && item.metadata?.to && (
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
      </div>

      {/* Order Statuses */}
      <Card className="border-none shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Order Statuses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ALL_STATUSES.map(status => {
              const count = Number(statusCounts[status] || 0);
              return (
                <div key={status} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-muted-foreground">{STATUS_LABELS[status]}</span>
                    <p className="text-lg font-bold text-card-foreground">{count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
