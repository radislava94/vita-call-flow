import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Eye, Download, ChevronLeft, ChevronRight, Filter, Search, Loader2,
  CalendarIcon, X, User, Hash, Tag,
} from 'lucide-react';
import { Check } from 'lucide-react';
import { apiGetOrders, apiGetAgents } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 20;

interface ApiOrder {
  id: string;
  display_id: string;
  product_name: string;
  price: number;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  assigned_agent_name: string | null;
  assigned_agent_id: string | null;
  created_at: string;
}

const STATUS_CHIP_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  take: 'bg-blue-100 text-blue-800 border-blue-200',
  call_again: 'bg-violet-100 text-violet-800 border-violet-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  shipped: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  returned: 'bg-rose-100 text-rose-800 border-rose-200',
  paid: 'bg-teal-100 text-teal-800 border-teal-200',
  trashed: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

export default function Orders() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([]);
  const [agentFilter, setAgentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedStatuses, agentFilter, dateFrom, dateTo]);

  // Agents list for admin
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: apiGetAgents,
    enabled: !!isAdmin,
  });

  // Fetch orders (server filters: status single + search)
  const fetchOrders = () => {
    setLoading(true);
    apiGetOrders({
      status: selectedStatuses.length === 1 ? selectedStatuses[0] : undefined,
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        setOrders(data.orders || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [page, selectedStatuses, debouncedSearch]);

  // Client-side additional filters
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Multi-status (if >1 selected, server didn't filter)
    if (selectedStatuses.length > 1) {
      result = result.filter(o => selectedStatuses.includes(o.status));
    }

    if (agentFilter !== 'all') {
      result = result.filter(o => o.assigned_agent_id === agentFilter);
    }

    if (dateFrom) {
      result = result.filter(o => new Date(o.created_at) >= dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(o => new Date(o.created_at) <= end);
    }

    return result;
  }, [orders, selectedStatuses, agentFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleStatus = (s: OrderStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const hasActiveFilters = search.trim() || selectedStatuses.length > 0 || agentFilter !== 'all' || dateFrom || dateTo;

  const clearAllFilters = () => {
    setSearch('');
    setSelectedStatuses([]);
    setAgentFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // Unique products from current page (for display)
  const uniqueProducts = useMemo(() => {
    const s = new Set<string>();
    orders.forEach(o => { if (o.product_name) s.add(o.product_name); });
    return Array.from(s).sort();
  }, [orders]);

  const exportCSV = () => {
    const header = 'Order ID,Product,Price,Status,Customer,Agent,Date\n';
    const rows = filteredOrders.map(o =>
      `${o.display_id},${o.product_name},${o.price},${o.status},${o.customer_name},${o.assigned_agent_name || 'Unassigned'},${new Date(o.created_at).toLocaleDateString()}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
  };

  return (
    <AppLayout title="Orders">
      {/* ══════ Filter Bar ══════ */}
      <div className="sticky top-0 z-10 mb-4 space-y-3">
        <div className="rounded-xl border bg-card/80 backdrop-blur-sm p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ID, customer, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 text-sm rounded-lg bg-background"
              />
            </div>

            {/* Status multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                  <Filter className="h-3.5 w-3.5" />
                  Status
                  {selectedStatuses.length > 0 && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {selectedStatuses.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {ALL_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        selectedStatuses.includes(s)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className={cn(
                        'h-3.5 w-3.5 rounded border-2 flex items-center justify-center transition-colors',
                        selectedStatuses.includes(s)
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/30'
                      )}>
                        {selectedStatuses.includes(s) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium border', STATUS_CHIP_COLORS[s])}>
                        {STATUS_LABELS[s]}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Agent filter */}
            {isAdmin && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                    <User className="h-3.5 w-3.5" />
                    {agentFilter === 'all' ? 'Agent' : (agentsData || []).find((a: any) => a.user_id === agentFilter)?.full_name || 'Agent'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => setAgentFilter('all')}
                      className={cn(
                        'flex w-full rounded-lg px-3 py-2 text-sm transition-colors',
                        agentFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                      )}
                    >
                      All Agents
                    </button>
                    {(agentsData || []).map((a: any) => (
                      <button
                        key={a.user_id}
                        onClick={() => setAgentFilter(a.user_id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                          agentFilter === a.user_id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                        )}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary shrink-0">
                          {a.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                        {a.full_name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Date from */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {/* Date to */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, 'MMM d') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {/* Clear All */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
                Clear all
              </Button>
            )}

            {/* Export */}
            <Button
              onClick={exportCSV}
              size="sm"
              className="ml-auto h-9 gap-1.5 rounded-lg text-sm"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* Active filter pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {selectedStatuses.map(s => (
              <Badge
                key={s}
                variant="secondary"
                className={cn('gap-1 cursor-pointer border text-xs', STATUS_CHIP_COLORS[s])}
                onClick={() => toggleStatus(s)}
              >
                {STATUS_LABELS[s]}
                <X className="h-3 w-3" />
              </Badge>
            ))}
            {agentFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setAgentFilter('all')}>
                Agent: {(agentsData || []).find((a: any) => a.user_id === agentFilter)?.full_name || agentFilter.slice(0, 8)}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setDateFrom(undefined)}>
                From: {format(dateFrom, 'MMM d')}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setDateTo(undefined)}>
                To: {format(dateTo, 'MMM d')}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {search.trim() && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setSearch('')}>
                "{search}"
                <X className="h-3 w-3" />
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredOrders.length} of {total} orders
            </span>
          </div>
        )}
      </div>

      {/* ══════ Table ══════ */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{order.display_id}</td>
                  <td className="px-4 py-3">{order.customer_name}</td>
                  <td className="px-4 py-3">{order.product_name}</td>
                  <td className="px-4 py-3 font-semibold">${Number(order.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {order.assigned_agent_name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {order.assigned_agent_name.charAt(0)}
                        </span>
                        {order.assigned_agent_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/orders/${order.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No orders found.
                    {hasActiveFilters && (
                      <button onClick={clearAllFilters} className="ml-1 text-primary hover:underline">Clear filters</button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                  p === page ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
