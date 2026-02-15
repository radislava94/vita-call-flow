import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, Search, Filter, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
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

const OUTCOME_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  no_answer: { label: 'No Answer', variant: 'secondary' },
  interested: { label: 'Interested', variant: 'default' },
  not_interested: { label: 'Not Interested', variant: 'destructive' },
  wrong_number: { label: 'Wrong Number', variant: 'outline' },
  call_again: { label: 'Call Again', variant: 'secondary' },
};

export default function CallHistoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const limit = 25;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, agentFilter, outcomeFilter, sourceFilter, dateFrom, dateTo]);

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: apiGetAgents,
    enabled: isAdmin,
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
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No call records found</TableCell></TableRow>
              ) : logs.map((log: any) => (
                <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString()}<br />
                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </TableCell>
                  <TableCell className="font-medium">{log.customer_name || '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{log.customer_phone || '—'}</TableCell>
                  <TableCell>{log.agent_name}</TableCell>
                  <TableCell>
                    <Badge variant={OUTCOME_LABELS[log.outcome]?.variant || 'outline'}>
                      {OUTCOME_LABELS[log.outcome]?.label || log.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.source === 'prediction_lead' ? 'Lead' : 'Order'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.product_name || '—'}</TableCell>
                  <TableCell>
                    {log.notes && <FileText className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

        {/* Detail modal */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" /> Call Details
              </DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedLog.customer_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-mono">{selectedLog.customer_phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Agent</p>
                    <p className="font-medium">{selectedLog.agent_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Outcome</p>
                    <Badge variant={OUTCOME_LABELS[selectedLog.outcome]?.variant || 'outline'}>
                      {OUTCOME_LABELS[selectedLog.outcome]?.label || selectedLog.outcome}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Source</p>
                    <p>{selectedLog.source === 'prediction_lead' ? 'Prediction Lead' : 'Standard Order'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date & Time</p>
                    <p>{new Date(selectedLog.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Product</p>
                    <p>{selectedLog.product_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reference ID</p>
                    <p className="font-mono text-xs">{selectedLog.display_id}</p>
                  </div>
                </div>
                {selectedLog.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Notes</p>
                    <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{selectedLog.notes}</div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
