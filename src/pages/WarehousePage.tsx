import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  apiGetProducts,
  apiGetIncomingOrders,
  apiGetUserWarehouseItems,
  apiAssignWarehouseItem,
  apiUpdateWarehouseItem,
  apiDeleteWarehouseItem,
  apiGetAgents,
} from '@/lib/api';
import {
  Package,
  Loader2,
  Download,
  Plus,
  Trash2,
  Edit,
  UserPlus,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Incoming Orders Tab ───────────────────────────────────────
function IncomingOrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [agents, setAgents] = useState<any[]>([]);

  const fetchOrders = () => {
    setLoading(true);
    apiGetIncomingOrders({
      agent_id: agentFilter || undefined,
      from: dateFrom ? dateFrom + 'T00:00:00Z' : undefined,
      to: dateTo ? dateTo + 'T23:59:59Z' : undefined,
      source: sourceFilter || undefined,
    })
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiGetAgents().then(setAgents).catch(() => {});
  }, []);

  useEffect(() => { fetchOrders(); }, [agentFilter, dateFrom, dateTo, sourceFilter]);

  const exportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['ID', 'Customer', 'Phone', 'Product', 'Price', 'Agent', 'Source', 'Date'];
    const rows = orders.map((o: any) => [
      o.display_id,
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      o.customer_phone || '',
      `"${(o.product_name || '').replace(/"/g, '""')}"`,
      o.price,
      o.assigned_agent_name || '',
      o.source === 'prediction_lead' ? 'Prediction Lead' : 'Standard Order',
      format(new Date(o.created_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `confirmed-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a: any) => (
              <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="order">Standard Orders</SelectItem>
            <SelectItem value="prediction_lead">Prediction Leads</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" placeholder="To" />
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={orders.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{orders.length} confirmed</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{o.display_id}</td>
                  <td className="px-4 py-3">{o.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.customer_phone || '—'}</td>
                  <td className="px-4 py-3">{o.product_name}</td>
                  <td className="px-4 py-3 font-semibold text-primary">
                    {o.source === 'order' ? `$${Number(o.price).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.assigned_agent_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={o.source === 'prediction_lead' ? 'secondary' : 'default'}>
                      {o.source === 'prediction_lead' ? 'Lead' : 'Order'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(o.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No confirmed orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────
function InventoryTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p: any) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-card-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.description || ''}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{p.sku || '—'}</td>
              <td className="px-4 py-3 font-semibold text-primary">${Number(p.price).toFixed(2)}</td>
              <td className="px-4 py-3">
                {p.stock_quantity <= 0 ? (
                  <Badge variant="destructive">Out of Stock</Badge>
                ) : p.stock_quantity < p.low_stock_threshold ? (
                  <Badge variant="destructive">{p.stock_quantity}</Badge>
                ) : (
                  <Badge className="bg-primary text-primary-foreground">{p.stock_quantity}</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant={p.is_active ? 'default' : 'secondary'}>
                  {p.is_active ? 'Active' : 'Disabled'}
                </Badge>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No products</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── User Warehouse Tab ────────────────────────────────────────
function UserWarehouseTab() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [formUserId, setFormUserId] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formQty, setFormQty] = useState('1');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    apiGetUserWarehouseItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    if (isAdmin) {
      apiGetAgents().then(setAgents).catch(() => {});
      apiGetProducts().then(setProducts).catch(() => {});
    }
  }, []);

  const handleAssign = async () => {
    if (!formUserId || !formProductId) return;
    setSaving(true);
    try {
      await apiAssignWarehouseItem({
        user_id: formUserId,
        product_id: formProductId,
        quantity: parseInt(formQty) || 1,
        notes: formNotes,
      });
      toast({ title: 'Item assigned' });
      setShowAssign(false);
      setFormUserId(''); setFormProductId(''); setFormQty('1'); setFormNotes('');
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      await apiUpdateWarehouseItem(editItem.id, {
        quantity: parseInt(formQty) || 0,
        notes: formNotes,
      });
      toast({ title: 'Updated' });
      setEditItem(null);
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteWarehouseItem(id);
      toast({ title: 'Item removed' });
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setFormQty(String(item.quantity));
    setFormNotes(item.notes || '');
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => { setFormUserId(''); setFormProductId(''); setFormQty('1'); setFormNotes(''); setShowAssign(true); }}>
            <UserPlus className="h-4 w-4 mr-1" /> Assign Item
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Assigned</th>
                {isAdmin && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.user_name}</td>
                  <td className="px-4 py-3">{item.product_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.product_sku || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-primary text-primary-foreground">{item.quantity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{item.notes || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(item.assigned_at), 'MMM d, yyyy')}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="rounded-md p-1.5 hover:bg-muted transition-colors" title="Edit">
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="rounded-md p-1.5 hover:bg-muted transition-colors" title="Remove">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">No items assigned</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Product to User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={formUserId} onValueChange={setFormUserId}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {agents.map((a: any) => (
                  <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={formProductId} onValueChange={setFormProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || 'No SKU'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="Quantity" min="1" />
            <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notes (optional)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || !formUserId || !formProductId}>
              {saving ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Quantity</label>
              <Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} min="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Warehouse Page ───────────────────────────────────────
export default function WarehousePage() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  return (
    <AppLayout title="Warehouse">
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          {isAdmin && <TabsTrigger value="incoming">Incoming Orders</TabsTrigger>}
          <TabsTrigger value="user-warehouse">User Warehouse</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="incoming">
            <IncomingOrdersTab />
          </TabsContent>
        )}

        <TabsContent value="user-warehouse">
          <UserWarehouseTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
