import { useEffect, useState } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { StatsCard } from '@/components/StatsCard';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import {
  Clock, PhoneCall, PhoneForwarded, CheckCircle2, Truck, RotateCcw,
  DollarSign, Trash2, XCircle, BarChart3, Users, Loader2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiGetOrderStats } from '@/lib/api';

const statusIcons: Record<OrderStatus, any> = {
  pending: Clock, take: PhoneCall, call_again: PhoneForwarded,
  confirmed: CheckCircle2, shipped: Truck, returned: RotateCcw,
  paid: DollarSign, trashed: Trash2, cancelled: XCircle,
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    apiGetOrderStats()
      .then((data) => {
        setStatusCounts(data.statusCounts || {});
        setAgentCounts(data.agentCounts || {});
        setDailyCounts(data.dailyCounts || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chartData = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, orders]) => ({
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      orders,
    }));

  const agentStats = Object.entries(agentCounts).map(([name, count]) => ({ name, count }));

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      {/* Status counters */}
      <div className="grid grid-cols-3 gap-4 lg:grid-cols-5 xl:grid-cols-9">
        {ALL_STATUSES.map(status => (
          <StatsCard
            key={status}
            title={STATUS_LABELS[status]}
            value={statusCounts[status] || 0}
            icon={statusIcons[status]}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Chart */}
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
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="orders" fill="hsl(27, 95%, 48%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Agent assignments */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Agent Assignments</h2>
          </div>
          <div className="space-y-3">
            {agentStats.length === 0 && (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            )}
            {agentStats.map(agent => (
              <div key={agent.name} className="flex items-center justify-between rounded-lg bg-muted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {agent.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{agent.name}</span>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {agent.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
