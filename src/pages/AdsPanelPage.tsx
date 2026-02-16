import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGetAdsCampaigns, apiCreateAdsCampaign, apiUpdateAdsCampaign, apiDeleteAdsCampaign } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import {
  Megaphone,
  Play,
  Pause,
  DollarSign,
  MousePointerClick,
  Target,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit,
  TrendingUp,
  BarChart3,
  Eye,
} from 'lucide-react';

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

export default function AdsPanelPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    campaign_name: '',
    platform: 'meta',
    budget: '',
    notes: '',
  });

  // Only ads_admin or admin can access - hooks must be above this
  const canAccess = user?.isAdsAdmin || user?.isAdmin;
  
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['ads-campaigns', platformFilter, statusFilter, search],
    queryFn: () => apiGetAdsCampaigns({ platform: platformFilter !== 'all' ? platformFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: apiCreateAdsCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      setCreateOpen(false);
      setForm({ campaign_name: '', platform: 'meta', budget: '', notes: '' });
      toast({ title: 'Campaign created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiUpdateAdsCampaign(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campaign updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteAdsCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] });
      toast({ title: 'Campaign deleted' });
    },
  });

  const toggleStatus = (c: Campaign) => {
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ id: c.id, status: newStatus });
  };

  // Aggregate stats
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

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout title="Ads Panel">
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Ads Panel</h1>
            <p className="text-sm text-muted-foreground">Manage ad campaigns across platforms</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Campaign Name</Label>
                  <Input value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} placeholder="Spring Sale 2026" />
                </div>
                <div>
                  <Label>Platform</Label>
                  <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Budget ($)</Label>
                  <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="1000" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Campaign details..." />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button
                  onClick={() => createMutation.mutate({ campaign_name: form.campaign_name, platform: form.platform, budget: Number(form.budget) || 0, notes: form.notes })}
                  disabled={!form.campaign_name || createMutation.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {statsCards.map(s => (
            <Card key={s.label} className="border-border/50 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg bg-muted p-2 ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
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
                {isLoading ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading campaigns...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No campaigns found. Create your first campaign above.</td></tr>
                ) : (
                  campaigns.map((c: Campaign) => {
                    const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
                    const isExpanded = expandedRow === c.id;
                    return (
                      <> 
                        <tr
                          key={c.id}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : c.id)}
                        >
                          <td className="p-3">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </td>
                          <td className="p-3 font-medium text-foreground">{c.campaign_name}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={`capitalize text-[11px] ${platformColors[c.platform] || ''}`}>{c.platform}</Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={`capitalize text-[11px] ${statusColors[c.status] || ''}`}>{c.status}</Badge>
                          </td>
                          <td className="p-3 text-right font-mono">{Number(c.budget).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{Number(c.spent).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{c.clicks.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{c.conversions.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono">{ctr}%</td>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => toggleStatus(c)}
                                title={c.status === 'active' ? 'Pause' : 'Resume'}
                              >
                                {c.status === 'active' ? <Pause className="h-3.5 w-3.5 text-amber-500" /> : <Play className="h-3.5 w-3.5 text-emerald-500" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => { if (confirm('Delete campaign?')) deleteMutation.mutate(c.id); }}
                              >
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
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{ width: `${Math.min((Number(c.spent) / Math.max(Number(c.budget), 1)) * 100, 100)}%` }}
                                      />
                                    </div>
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
    </AppLayout>
  );
}
