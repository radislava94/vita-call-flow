import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGetOperationsCenter } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Activity, Users, ShoppingCart, Truck, RotateCcw, DollarSign,
  RefreshCw, Loader2, Circle, CheckCircle2, Clock, TrendingUp,
  Zap,
} from 'lucide-react';

interface AgentInfo {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_online: boolean;
  login_time: string | null;
  active_leads: number;
  today_confirmed: number;
  today_total: number;
}

interface OpsData {
  kpi: {
    total_orders_today: number;
    confirmed_today: number;
    shipped_today: number;
    returned_today: number;
    paid_today: number;
    revenue_today: number;
  };
  agents: AgentInfo[];
  agents_online: number;
  agents_total: number;
}

export default function OperationsPage() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await apiGetOperationsCenter();
      setData(result);
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <AppLayout title="Operations Center">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const kpi = data?.kpi;
  const agents = data?.agents || [];
  const onlineAgents = agents.filter(a => a.is_online);
  const offlineAgents = agents.filter(a => !a.is_online);

  const kpiCards = [
    { label: 'Orders Today', value: kpi?.total_orders_today || 0, icon: ShoppingCart, color: 'bg-primary/10 text-primary' },
    { label: 'Confirmed', value: kpi?.confirmed_today || 0, icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-600' },
    { label: 'Shipped', value: kpi?.shipped_today || 0, icon: Truck, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Paid', value: kpi?.paid_today || 0, icon: DollarSign, color: 'bg-violet-500/10 text-violet-600' },
    { label: 'Returns', value: kpi?.returned_today || 0, icon: RotateCcw, color: (kpi?.returned_today || 0) > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground' },
    { label: "Today's Revenue", value: `$${(kpi?.revenue_today || 0).toLocaleString()}`, icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-600' },
  ];

  return (
    <AppLayout title="Operations Center">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Operations Command Center</h1>
              <p className="text-xs text-muted-foreground">
                Live data · Last updated {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              <Circle className={cn("h-2 w-2 fill-current", (data?.agents_online || 0) > 0 ? "text-emerald-500" : "text-muted-foreground")} />
              {data?.agents_online || 0} / {data?.agents_total || 0} Online
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map(card => (
            <Card key={card.label} className="border-none shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", card.color)}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground leading-tight">{card.label}</p>
                  <p className="text-xl font-bold">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Online Agents */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                Online Agents ({onlineAgents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {onlineAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No agents currently online</p>
              ) : (
                onlineAgents.map(agent => (
                  <div key={agent.user_id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                        <Users className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{agent.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {agent.login_time ? `Since ${new Date(agent.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Active'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-primary">{agent.active_leads}</p>
                        <p className="text-muted-foreground">Active</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-emerald-600">{agent.today_confirmed}</p>
                        <p className="text-muted-foreground">Confirmed</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{agent.today_total}</p>
                        <p className="text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Offline Agents */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Circle className="h-2.5 w-2.5 fill-muted-foreground text-muted-foreground" />
                Offline Agents ({offlineAgents.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {offlineAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">All agents are online</p>
              ) : (
                offlineAgents.map(agent => (
                  <div key={agent.user_id} className="flex items-center justify-between rounded-lg border border-dashed p-3 opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{agent.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">Offline</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-bold">{agent.active_leads}</p>
                        <p className="text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{agent.today_total}</p>
                        <p className="text-muted-foreground">Today</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
