import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { apiGetInboundLeads, apiUpdateInboundLead, apiDeleteInboundLead } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Phone, User, Clock, Trash2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['pending', 'contacted', 'converted', 'rejected'] as const;
type InboundStatus = typeof STATUS_OPTIONS[number];

const STATUS_STYLES: Record<InboundStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  contacted: 'bg-blue-100 text-blue-800 border-blue-200',
  converted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

interface InboundLead {
  id: string;
  name: string;
  phone: string;
  status: InboundStatus;
  source: string;
  created_at: string;
  updated_at: string;
}

export default function InboundLeadsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: leads = [], isLoading } = useQuery<InboundLead[]>({
    queryKey: ['inbound-leads', statusFilter],
    queryFn: () => apiGetInboundLeads(statusFilter),
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiUpdateInboundLead(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({ title: 'Lead updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteInboundLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-leads'] });
      toast({ title: 'Lead deleted' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const filtered = search.trim()
    ? leads.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search)
      )
    : leads;

  const pendingCount = leads.filter(l => l.status === 'pending').length;

  if (isLoading) {
    return (
      <AppLayout title="Inbound Leads">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Inbound Leads">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{leads.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
              <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Converted</p>
              <p className="text-xl font-bold">{leads.filter(l => l.status === 'converted').length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500">
              <XCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="text-xl font-bold">{leads.filter(l => l.status === 'rejected').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm rounded-lg">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} leads</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{lead.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{lead.phone}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={lead.status}
                      onValueChange={val => updateMutation.mutate({ id: lead.id, body: { status: val } })}
                    >
                      <SelectTrigger className={cn('h-7 w-28 text-xs rounded-full border', STATUS_STYLES[lead.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{lead.source}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(lead.created_at), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(lead.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No inbound leads yet. Share your webhook URL to start receiving leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhook info */}
      <Card className="mt-6 border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Webhook Endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Send a POST request with JSON body to receive leads:</p>
          <code className="block rounded-lg bg-muted p-3 text-xs font-mono break-all">
            POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/webhook/leads
          </code>
          <p className="text-xs text-muted-foreground">Body:</p>
          <pre className="rounded-lg bg-muted p-3 text-xs font-mono">
{`{
  "name": "John Doe",
  "phone": "+1234567890",
  "status": "pending",
  "source": "landing_page"
}`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Headers: <code className="bg-muted px-1 rounded">Content-Type: application/json</code>,{' '}
            <code className="bg-muted px-1 rounded">apikey: YOUR_ANON_KEY</code>
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
