import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, RotateCcw, DollarSign, BarChart3, MapPin, Package, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

interface InsightsData {
  returns_by_product: { product: string; returns: number; total: number }[];
  returns_by_city: { city: string; returns: number; total: number }[];
  agent_stats: {
    agent: string; agent_id: string;
    revenue: number; orders: number; paid: number; returned: number;
    confirmed: number; shipped: number;
  }[];
  agent_aov: Record<string, number>;
  source_stats: { source: string; revenue: number; orders: number; paid: number }[];
  total_orders: number;
  total_revenue: number;
  total_returned: number;
}

const CHART_COLORS = [
  'hsl(27, 95%, 48%)', 'hsl(217, 91%, 60%)', 'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)',
  'hsl(190, 95%, 39%)', 'hsl(340, 82%, 52%)',
];

export default function ManagementInsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const res = await fetch(`${API_BASE}/management-insights?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (res.ok) setData(await res.json());
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInsights(); }, [fromDate, toDate]);

  return (
    <AppLayout title="Management Insights">
      <div className="space-y-6">
        {/* Date Filters */}
        <div className="flex gap-3 items-center">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 w-40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 w-40" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2.5"><DollarSign className="h-5 w-5 text-primary" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Revenue (Paid)</p>
                      <p className="text-2xl font-bold">{data.total_revenue.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-info/10 p-2.5"><BarChart3 className="h-5 w-5 text-info" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Orders</p>
                      <p className="text-2xl font-bold">{data.total_orders}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-destructive/10 p-2.5"><RotateCcw className="h-5 w-5 text-destructive" /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Returns</p>
                      <p className="text-2xl font-bold">{data.total_returned}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Revenue & Performance by Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-2 px-2">Agent</th>
                        <th className="text-right py-2 px-2">Orders</th>
                        <th className="text-right py-2 px-2">Paid</th>
                        <th className="text-right py-2 px-2">Returned</th>
                        <th className="text-right py-2 px-2">Revenue</th>
                        <th className="text-right py-2 px-2">AOV</th>
                        <th className="text-right py-2 px-2">Return %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.agent_stats.map(a => (
                        <tr key={a.agent_id} className="border-b last:border-0">
                          <td className="py-2 px-2 font-medium">{a.agent}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{a.orders}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-emerald-600 font-medium">{a.paid}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-rose-600">{a.returned}</td>
                          <td className="py-2 px-2 text-right tabular-nums font-medium">{a.revenue.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right tabular-nums">{(data.agent_aov[a.agent_id] || 0).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            {a.orders > 0 ? ((a.returned / a.orders) * 100).toFixed(1) + '%' : '0%'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Returns by Product */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5" /> Returns by Product</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.returns_by_product.filter(p => p.returns > 0).length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data.returns_by_product.filter(p => p.returns > 0).slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="product" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="returns" fill="hsl(0, 84%, 60%)" name="Returns" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="total" fill="hsl(217, 91%, 60%)" name="Total Orders" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No returns in this period</p>
                  )}
                </CardContent>
              </Card>

              {/* Returns by City */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Returns by City</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.returns_by_city.filter(c => c.returns > 0).length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data.returns_by_city.filter(c => c.returns > 0).slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="city" type="category" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="returns" fill="hsl(0, 84%, 60%)" name="Returns" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No returns in this period</p>
                  )}
                </CardContent>
              </Card>

              {/* Revenue by Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Revenue by Lead Source</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.source_stats.length > 0 ? (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="50%" height={200}>
                        <PieChart>
                          <Pie
                            data={data.source_stats}
                            dataKey="revenue"
                            nameKey="source"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ source }) => source}
                          >
                            {data.source_stats.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 text-sm">
                        {data.source_stats.map((s, i) => (
                          <div key={s.source} className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="capitalize">{s.source.replace(/_/g, ' ')}</span>
                            <span className="text-muted-foreground ml-auto tabular-nums">{s.revenue.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                  )}
                </CardContent>
              </Card>

              {/* Agent Revenue Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5" /> Agent Revenue Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.agent_stats.filter(a => a.revenue > 0).length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data.agent_stats.filter(a => a.revenue > 0)}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="agent" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="hsl(27, 95%, 48%)" name="Revenue" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No revenue data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-12">Failed to load insights</p>
        )}
      </div>
    </AppLayout>
  );
}
