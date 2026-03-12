import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { apiGetWebhooks, apiCreateWebhook, apiUpdateWebhook, apiDeleteWebhook, apiGetAdsCampaigns, apiCreateAdsCampaign, apiUpdateAdsCampaign, apiDeleteAdsCampaign } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Copy, Pencil, Trash2, Loader2, Webhook, CheckCircle2, XCircle, Globe,
  Megaphone, Play, Pause, DollarSign, MousePointerClick, Target, Search,
  ChevronDown, ChevronRight, BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

/* ── Types ── */
interface WebhookItem {
  id: string;
  product_name: string;
  description: string;
  slug: string;
  status: string;
  created_at: string;
  total_leads: number;
}

interface Campaign {
  id: string;
  campaign_name: string;
  platform: string;
  status: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  assigned_products: string[];
  assigned_leads: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/* ── Constants ── */
const PLATFORMS = ['meta', 'google', 'tiktok'] as const;
const STATUSES = ['active', 'paused', 'completed', 'draft'] as const;

const platformColors: Record<string, string> = {
  meta: 'bg-blue-500/10 text-blue-600 border-blue-200',
  google: 'bg-red-500/10 text-red-600 border-red-200',
  tiktok: 'bg-pink-500/10 text-pink-600 border-pink-200',
};
const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-200',
  completed: 'bg-muted text-muted-foreground border-border',
  draft: 'bg-slate-500/10 text-slate-600 border-slate-200',
};

/* ================================================================ */
/*  WEBHOOKS TAB                                                     */
/* ================================================================ */
function WebhooksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState('active');

  const { data: webhooks = [], isLoading } = useQuery<WebhookItem[]>({
    queryKey: ['webhooks'],
    queryFn: apiGetWebhooks,
  });

  const createMutation = useMutation({
    mutationFn: (body: { product_name: string; description?: string }) => apiCreateWebhook(body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setCreateOpen(false); setFormName(''); setFormDesc(''); toast({ title: 'Webhook created successfully' }); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiUpdateWebhook(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setEditWebhook(null); toast({ title: 'Webhook updated' }); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteWebhook(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setDeleteId(null); toast({ title: 'Webhook deleted' }); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const getWebhookUrl = (slug: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/webhook/${slug}`;

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(getWebhookUrl(slug));
    toast({ title: 'Webhook URL copied to clipboard' });
  };

  const openEdit = (wh: WebhookItem) => {
    setEditWebhook(wh); setFormName(wh.product_name); setFormDesc(wh.description || ''); setFormStatus(wh.status);
  };

  const handleCreate = () => { if (!formName.trim()) return; createMutation.mutate({ product_name: formName.trim(), description: formDesc.trim() }); };
  const handleUpdate = () => { if (!editWebhook || !formName.trim()) return; updateMutation.mutate({ id: editWebhook.id, body: { product_name: formName.trim(), description: formDesc.trim(), status: formStatus } }); };

  const activeCount = webhooks.filter(w => w.status === 'active').length;
  const totalLeads = webhooks.reduce((s, w) => s + (w.total_leads || 0), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary"><Webhook className="h-5 w-5 text-primary-foreground" /></div><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{webhooks.length}</p></div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--success))]"><CheckCircle2 className="h-5 w-5 text-primary-foreground" /></div><div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold">{activeCount}</p></div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--warning))]"><XCircle className="h-5 w-5 text-primary-foreground" /></div><div><p className="text-xs text-muted-foreground">Disabled</p><p className="text-xl font-bold">{webhooks.length - activeCount}</p></div></CardContent></Card>
        <Card className="border-none shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--info))]"><Globe className="h-5 w-5 text-primary-foreground" /></div><div><p className="text-xs text-muted-foreground">Total Leads</p><p className="text-xl font-bold">{totalLeads}</p></div></CardContent></Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All Webhooks</h2>
        <Button onClick={() => { setFormName(''); setFormDesc(''); setCreateOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Create New Webhook</Button>
      </div>

      {/* Webhooks table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Webhook URL</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Leads</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map(wh => (
                <tr key={wh.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3"><div><span className="font-medium">{wh.product_name}</span>{wh.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{wh.description}</p>}</div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[280px] block">{getWebhookUrl(wh.slug)}</code><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyUrl(wh.slug)}><Copy className="h-3.5 w-3.5" /></Button></div></td>
                  <td className="px-4 py-3"><Badge variant={wh.status === 'active' ? 'default' : 'secondary'} className={cn('text-xs', wh.status === 'active' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30' : 'bg-muted text-muted-foreground')}>{wh.status === 'active' ? 'Active' : 'Disabled'}</Badge></td>
                  <td className="px-4 py-3 font-semibold">{wh.total_leads || 0}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(wh.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(wh)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(wh.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></td>
                </tr>
              ))}
              {webhooks.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No webhooks yet. Create one to start receiving leads.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage info */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">How to Use</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Send a POST request to your webhook URL with JSON body:</p>
          <pre className="rounded-lg bg-muted p-3 text-xs font-mono">{`{\n  "name": "John Doe",\n  "phone": "+1234567890"\n}`}</pre>
          <p className="text-xs text-muted-foreground">
            Headers: <code className="bg-muted px-1 rounded">Content-Type: application/json</code>,{' '}
            <code className="bg-muted px-1 rounded">apikey: {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}</code>
          </p>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Webhook</DialogTitle><DialogDescription>Create a webhook endpoint linked to a product name.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Product Name</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Vitamin C Serum" className="mt-1" /></div>
            <div><Label>Description (optional)</Label><Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Landing page for..." className="mt-1" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || createMutation.isPending}>{createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editWebhook} onOpenChange={() => setEditWebhook(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Webhook</DialogTitle><DialogDescription>Update webhook settings.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Product Name</Label><Input value={formName} onChange={e => setFormName(e.target.value)} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="mt-1" rows={3} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={formStatus === 'active'} onCheckedChange={v => setFormStatus(v ? 'active' : 'disabled')} /></div>
            {editWebhook && <div><Label className="text-xs text-muted-foreground">Webhook URL</Label><div className="flex items-center gap-2 mt-1"><code className="text-xs font-mono bg-muted px-2 py-1.5 rounded flex-1 truncate">{getWebhookUrl(editWebhook.slug)}</code><Button variant="outline" size="sm" onClick={() => copyUrl(editWebhook.slug)}><Copy className="h-3.5 w-3.5" /></Button></div></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWebhook(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={!formName.trim() || updateMutation.isPending}>{updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Webhook?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the webhook. Existing leads will be kept but no new leads can be received through this URL.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================================================================ */
/*  ADS TAB                                                          */
/* ================================================================ */
function AdsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ campaign_name: '', platform: 'meta', budget: '', notes: '' });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['ads-campaigns', platformFilter, statusFilter, search],
    queryFn: () => apiGetAdsCampaigns({ platform: platformFilter !== 'all' ? platformFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: apiCreateAdsCampaign,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] }); setCreateOpen(false); setForm({ campaign_name: '', platform: 'meta', budget: '', notes: '' }); toast({ title: 'Campaign created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiUpdateAdsCampaign(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] }); toast({ title: 'Campaign updated' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteAdsCampaign,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] }); toast({ title: 'Campaign deleted' }); },
  });

  const toggleStatus = (c: Campaign) => {
    updateMutation.mutate({ id: c.id, status: c.status === 'active' ? 'paused' : 'active' });
  };

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c: Campaign) => c.status === 'active').length;
  const pausedCampaigns = campaigns.filter((c: Campaign) => c.status === 'paused').length;
  const totalSpend = campaigns.reduce((s: number, c: Campaign) => s + Number(c.spent || 0), 0);
  const totalClicks = campaigns.reduce((s: number, c: Campaign) => s + (c.clicks || 0), 0);
  const totalConversions = campaigns.reduce((s: number, c: Campaign) => s + (c.conversions || 0), 0);

  const statsCards = [
    { label: 'Total Campaigns', value: totalCampaigns, icon: Megaphone, color: 'text-primary' },
    { label: 'Active', value: activeCampaigns, icon: Play, color: 'text-emerald-500' },
    { label: 'Paused', value: pausedCampaigns, icon: Pause, color: 'text-amber-500' },
    { label: 'Total Spend', value: totalSpend.toLocaleString(), icon: DollarSign, color: 'text-blue-500' },
    { label: 'Total Clicks', value: totalClicks.toLocaleString(), icon: MousePointerClick, color: 'text-violet-500' },
    { label: 'Conversions', value: totalConversions.toLocaleString(), icon: Target, color: 'text-rose-500' },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Manage ad campaigns across platforms</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Campaign Name</Label><Input value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} placeholder="Spring Sale 2026" /></div>
              <div><Label>Platform</Label><Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Budget ($)</Label><Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="1000" /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Campaign details..." /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={() => createMutation.mutate({ campaign_name: form.campaign_name, platform: form.platform, budget: Number(form.budget) || 0, notes: form.notes })} disabled={!form.campaign_name || createMutation.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statsCards.map(s => (
          <Card key={s.label} className="border-border/50 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`rounded-lg bg-muted p-2 ${s.color}`}><s.icon className="h-4 w-4" /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold text-foreground">{s.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Platforms</SelectItem>{PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ScrollArea className="max-h-[calc(100vh-420px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b border-border">
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="p-3 w-8" />
                <th className="p-3">Campaign</th>
                <th className="p-3">Platform</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Budget</th>
                <th className="p-3 text-right">Spent</th>
                <th className="p-3 text-right">Clicks</th>
                <th className="p-3 text-right">Conv.</th>
                <th className="p-3 text-right">CTR</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No campaigns found. Create your first campaign above.</td></tr>
              ) : (
                campaigns.map((c: Campaign) => {
                  const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
                  const isExpanded = expandedRow === c.id;
                  return (
                    <> 
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : c.id)}>
                        <td className="p-3">{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</td>
                        <td className="p-3 font-medium text-foreground">{c.campaign_name}</td>
                        <td className="p-3"><Badge variant="outline" className={`capitalize text-[11px] ${platformColors[c.platform] || ''}`}>{c.platform}</Badge></td>
                        <td className="p-3"><Badge variant="outline" className={`capitalize text-[11px] ${statusColors[c.status] || ''}`}>{c.status}</Badge></td>
                        <td className="p-3 text-right font-mono">{Number(c.budget).toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{Number(c.spent).toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{c.clicks.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{c.conversions.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{ctr}%</td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleStatus(c)} title={c.status === 'active' ? 'Pause' : 'Resume'}>
                              {c.status === 'active' ? <Pause className="h-3.5 w-3.5 text-amber-500" /> : <Play className="h-3.5 w-3.5 text-emerald-500" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Delete campaign?')) deleteMutation.mutate(c.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${c.id}-detail`} className="bg-muted/20">
                          <td colSpan={10} className="p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Performance</h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between"><span className="text-muted-foreground">Impressions</span><span className="font-mono">{c.impressions.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Clicks</span><span className="font-mono">{c.clicks.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Conversions</span><span className="font-mono">{c.conversions.toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">CTR</span><span className="font-mono">{ctr}%</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">CPC</span><span className="font-mono">{c.clicks > 0 ? (Number(c.spent) / c.clicks).toFixed(2) : '0.00'}</span></div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Budget</h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between"><span className="text-muted-foreground">Total Budget</span><span className="font-mono">{Number(c.budget).toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Spent</span><span className="font-mono">{Number(c.spent).toLocaleString()}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><span className="font-mono">{(Number(c.budget) - Number(c.spent)).toLocaleString()}</span></div>
                                </div>
                                <div className="mt-2">
                                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min((Number(c.spent) / Math.max(Number(c.budget), 1)) * 100, 100)}%` }} /></div>
                                  <p className="mt-1 text-xs text-muted-foreground">{((Number(c.spent) / Math.max(Number(c.budget), 1)) * 100).toFixed(1)}% utilized</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground">Notes</h4>
                                <p className="text-sm text-muted-foreground">{c.notes || 'No notes'}</p>
                                <p className="text-xs text-muted-foreground mt-2">Created: {new Date(c.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

/* ================================================================ */
/*  MAIN PAGE                                                        */
/* ================================================================ */
export default function WebhookManagementPage() {
  const { user } = useAuth();
  const canSeeAds = user?.isAdsAdmin || user?.isAdmin;

  return (
    <AppLayout title="Webhooks & Ads">
      <Tabs defaultValue="webhooks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </TabsTrigger>
          {canSeeAds && (
            <TabsTrigger value="ads" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Ads Panel
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="webhooks">
          <WebhooksTab />
        </TabsContent>

        {canSeeAds && (
          <TabsContent value="ads">
            <AdsTab />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}
