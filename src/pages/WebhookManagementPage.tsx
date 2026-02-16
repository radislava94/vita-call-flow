import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { apiGetWebhooks, apiCreateWebhook, apiUpdateWebhook, apiDeleteWebhook } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Pencil, Trash2, Loader2, Webhook, CheckCircle2, XCircle, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface WebhookItem {
  id: string;
  product_name: string;
  description: string;
  slug: string;
  status: string;
  created_at: string;
  total_leads: number;
}

export default function WebhookManagementPage() {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setCreateOpen(false);
      setFormName('');
      setFormDesc('');
      toast({ title: 'Webhook created successfully' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiUpdateWebhook(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setEditWebhook(null);
      toast({ title: 'Webhook updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setDeleteId(null);
      toast({ title: 'Webhook deleted' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const getWebhookUrl = (slug: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/webhook/${slug}`;

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(getWebhookUrl(slug));
    toast({ title: 'Webhook URL copied to clipboard' });
  };

  const openEdit = (wh: WebhookItem) => {
    setEditWebhook(wh);
    setFormName(wh.product_name);
    setFormDesc(wh.description || '');
    setFormStatus(wh.status);
  };

  const handleCreate = () => {
    if (!formName.trim()) return;
    createMutation.mutate({ product_name: formName.trim(), description: formDesc.trim() });
  };

  const handleUpdate = () => {
    if (!editWebhook || !formName.trim()) return;
    updateMutation.mutate({
      id: editWebhook.id,
      body: { product_name: formName.trim(), description: formDesc.trim(), status: formStatus },
    });
  };

  const activeCount = webhooks.filter(w => w.status === 'active').length;
  const totalLeads = webhooks.reduce((s, w) => s + (w.total_leads || 0), 0);

  if (isLoading) {
    return (
      <AppLayout title="Webhook Management">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Webhook Management">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Webhook className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{webhooks.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--success))]">
              <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--warning))]">
              <XCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disabled</p>
              <p className="text-xl font-bold">{webhooks.length - activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--info))]">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Leads</p>
              <p className="text-xl font-bold">{totalLeads}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">All Webhooks</h2>
        <Button onClick={() => { setFormName(''); setFormDesc(''); setCreateOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Create New Webhook
        </Button>
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
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{wh.product_name}</span>
                      {wh.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{wh.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[280px] block">
                        {getWebhookUrl(wh.slug)}
                      </code>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyUrl(wh.slug)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={wh.status === 'active' ? 'default' : 'secondary'}
                      className={cn(
                        'text-xs',
                        wh.status === 'active'
                          ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {wh.status === 'active' ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold">{wh.total_leads || 0}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(wh.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(wh)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(wh.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {webhooks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No webhooks yet. Create one to start receiving leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage info */}
      <Card className="mt-6 border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Send a POST request to your webhook URL with JSON body:</p>
          <pre className="rounded-lg bg-muted p-3 text-xs font-mono">
{`{
  "name": "John Doe",
  "phone": "+1234567890"
}`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Headers: <code className="bg-muted px-1 rounded">Content-Type: application/json</code>,{' '}
            <code className="bg-muted px-1 rounded">apikey: {import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}</code>
          </p>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Webhook</DialogTitle>
            <DialogDescription>Create a webhook endpoint linked to a product name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Vitamin C Serum" className="mt-1" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Landing page for..." className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editWebhook} onOpenChange={() => setEditWebhook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update webhook settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} className="mt-1" rows={3} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formStatus === 'active'} onCheckedChange={v => setFormStatus(v ? 'active' : 'disabled')} />
            </div>
            {editWebhook && (
              <div>
                <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded flex-1 truncate">
                    {getWebhookUrl(editWebhook.slug)}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyUrl(editWebhook.slug)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWebhook(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={!formName.trim() || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the webhook. Existing leads will be kept but no new leads can be received through this URL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
