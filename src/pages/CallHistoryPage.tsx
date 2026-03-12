import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, Search, Filter, ChevronLeft, ChevronRight, FileText, ShoppingCart, Clock, MapPin, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCallHistory, apiGetAgents } from '@/lib/api';
import { AppLayout } from '@/layouts/AppLayout';
import { cn } from '@/lib/utils';

const OUTCOME_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  no_answer: { label: 'No Answer', variant: 'secondary' },
  interested: { label: 'Interested', variant: 'default' },
  not_interested: { label: 'Not Interested', variant: 'destructive' },
  wrong_number: { label: 'Wrong Number', variant: 'outline' },
  call_again: { label: 'Call Again', variant: 'secondary' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  take: 'bg-blue-100 text-blue-800',
  call_again: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  shipped: 'bg-sky-100 text-sky-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  returned: 'bg-rose-100 text-rose-800',
  paid: 'bg-purple-100 text-purple-800',
  trashed: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-700',
  not_contacted: 'bg-gray-100 text-gray-700',
  no_answer: 'bg-amber-100 text-amber-700',
  interested: 'bg-blue-100 text-blue-700',
  not_interested: 'bg-rose-100 text-rose-700',
};

export default function CallHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || user?.isManager;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const limit = 25;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, agentFilter, outcomeFilter, sourceFilter, dateFrom, dateTo]);

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: apiGetAgents,
    enabled: !!isAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['call-history', debouncedSearch, agentFilter, outcomeFilter, sourceFilter, dateFrom, dateTo, page],
    queryFn: () => apiGetCallHistory({
      search: debouncedSearch || undefined,
      agent_id: agentFilter !== 'all' ? agentFilter : undefined,
      outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
      from: dateFrom ? dateFrom.toISOString() : undefined,
      to: dateTo ? dateTo.toISOString() : undefined,
      page,
      limit,
    }),
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout title="Call History">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Call History</h1>
            <p className="text-sm text-muted-foreground">{total} call records</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customer, agent, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isAdmin && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {(agentsData || []).map((a: any) => (
                  <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Outcome" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="order">Standard Order</SelectItem>
              <SelectItem value="prediction_lead">Prediction Lead</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'MMM d') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo || agentFilter !== 'all' || outcomeFilter !== 'all' || sourceFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => {
              setDateFrom(undefined);
              setDateTo(undefined);
              setAgentFilter('all');
              setOutcomeFilter('all');
              setSourceFilter('all');
            }}>Clear</Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]"></TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No call records found</TableCell></TableRow>
              ) : logs.map((log: any) => {
                const isExpanded = expandedRows.has(log.id);
                return (
                  <TableRow key={log.id} className="group">
                    <TableCell className="px-2">
                      <button onClick={() => toggleRow(log.id)} className="p-0.5 rounded hover:bg-muted transition-colors">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy')}<br />
                      <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm')}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{log.customer_name || '—'}</span>
                        {log.customer_city && (
                          <span className="block text-[11px] text-muted-foreground">{log.customer_city}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.customer_phone || '—'}</TableCell>
                    <TableCell className="text-sm">{log.agent_name}</TableCell>
                    <TableCell>
                      <Badge variant={OUTCOME_LABELS[log.outcome]?.variant || 'outline'}>
                        {OUTCOME_LABELS[log.outcome]?.label || log.outcome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.source === 'prediction_lead' ? 'Lead' : 'Order'}
                      </Badge>
                      {log.display_id && (
                        <span className="block text-[10px] font-mono text-muted-foreground mt-0.5">{log.display_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-xs whitespace-normal leading-relaxed">
                        {log.product_items?.length > 0 ? (
                          log.product_items.map((item: any, idx: number) => (
                            <span key={idx}>
                              {idx > 0 && <span className="text-muted-foreground">, </span>}
                              <span className="font-medium">{item.product_name}</span>
                              <span className="text-muted-foreground"> x{item.quantity}</span>
                            </span>
                          ))
                        ) : (
                          <span>{log.product_name || '—'}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums font-medium">
                      {Number(log.total_price || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.order_status && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[log.order_status] || 'bg-muted text-muted-foreground')}>
                          {log.order_status}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Expanded detail rows */}
          {logs.filter((l: any) => expandedRows.has(l.id)).map((log: any) => (
            <div key={`detail-${log.id}`} className="border-t bg-muted/30 px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Customer</span>
                  <span className="font-medium">{log.customer_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Phone</span>
                  <span className="font-mono text-xs">{log.customer_phone || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">City</span>
                  <span>{log.customer_city || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Address</span>
                  <span>{log.customer_address || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Agent</span>
                  <span className="font-medium">{log.agent_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Order Agent</span>
                  <span>{log.order_agent || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Source</span>
                  <span className="capitalize">{(log.order_source || log.source || '').replace(/_/g, ' ')}</span>
                  {log.list_name && <span className="block text-[11px] text-muted-foreground">{log.list_name}</span>}
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Reference</span>
                  <span className="font-mono text-xs">{log.display_id}</span>
                </div>
              </div>

              {/* Product Items Detail */}
              {log.product_items?.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" /> Products ({log.product_items.length})
                  </h4>
                  <div className="rounded-md border bg-card overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Product</th>
                          <th className="text-center px-3 py-1.5 font-medium text-muted-foreground">Qty</th>
                          <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Unit Price</th>
                          <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.product_items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-3 py-1.5 font-medium">{item.product_name}</td>
                            <td className="px-3 py-1.5 text-center tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-mono">{Number(item.price_per_unit).toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-mono font-medium">{Number(item.total_price).toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30">
                          <td colSpan={3} className="px-3 py-1.5 text-right font-semibold">Total</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-mono font-bold text-primary">
                            {Number(log.total_price || 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Status History */}
              {log.status_history?.length > 0 && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Status History
                  </h4>
                  <div className="space-y-1">
                    {log.status_history.map((h: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-[100px] shrink-0">
                          {format(new Date(h.changed_at), 'dd/MM/yy HH:mm')}
                        </span>
                        {h.from_status && (
                          <>
                            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_COLORS[h.from_status] || 'bg-muted')}>
                              {h.from_status}
                            </span>
                            <span className="text-muted-foreground">→</span>
                          </>
                        )}
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', STATUS_COLORS[h.to_status] || 'bg-muted')}>
                          {h.to_status}
                        </span>
                        {h.changed_by_name && (
                          <span className="text-muted-foreground ml-auto">by {h.changed_by_name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {log.notes && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Notes
                  </h4>
                  <div className="rounded-md bg-card border p-2.5 text-sm whitespace-pre-wrap">{log.notes}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} records)
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
