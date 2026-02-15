import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  apiUpdateOrderStatus,
} from '@/lib/api';
import {
  Package,
  Loader2,
  Download,
  Plus,
  Trash2,
  Edit,
  UserPlus,
  ChevronRight,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Incoming Orders Tab ───────────────────────────────────────
function IncomingOrdersTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = () => {
    setLoading(true);
    apiGetIncomingOrders({
      agent_id: agentFilter || undefined,
      from: dateFrom ? dateFrom + 'T00:00:00Z' : undefined,
      to: dateTo ? dateTo + 'T23:59:59Z' : undefined,
      source: sourceFilter || undefined,
      status: statusFilter || undefined,
    })
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    apiGetAgents().then(setAgents).catch(() => {});
  }, []);

  useEffect(() => { fetchOrders(); }, [agentFilter, dateFrom, dateTo, sourceFilter, statusFilter]);

  // Group orders by date
  const groupedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const o of orders) {
      const dateKey = format(new Date(o.created_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(o);
    }
    // Sort dates descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [orders]);

  // Track which folders are open. Default: today open
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setOpenDates(new Set([todayStr]));
  }, []);

  const toggleDate = (date: string) => {
    setOpenDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleStatusChange = async (orderId: string, source: string, newStatus: string) => {
    if (source === 'prediction_lead_direct') {
      toast({ title: 'Cannot change status', description: 'This lead has no linked order yet', variant: 'destructive' });
      return;
    }
    setUpdatingId(orderId);
    try {
      await apiUpdateOrderStatus(orderId, newStatus);
      toast({ title: `Status updated to ${newStatus}` });
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['ID', 'Customer', 'Phone', 'Product', 'Price', 'Agent', 'Source', 'Status', 'Date'];
    const rows = orders.map((o: any) => [
      o.display_id,
      `"${(o.customer_name || '').replace(/"/g, '""')}"`,
      o.customer_phone || '',
      `"${(o.product_name || '').replace(/"/g, '""')}"`,
      o.price,
      o.assigned_agent_name || '',
      o.source === 'prediction_lead' ? 'Prediction Lead' : 'Standard Order',
      o.status,
      format(new Date(o.created_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    if (status === 'shipped') return <Badge className="bg-green-500/15 text-green-700 border-green-500/30">Shipped</Badge>;
    if (status === 'delivered') return <Badge className="bg-sky-500/15 text-sky-700 border-sky-500/30">Delivered</Badge>;
    if (status === 'paid') return <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30">Paid</Badge>;
    return <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30">Confirmed</Badge>;
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" placeholder="From" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" placeholder="To" />
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={orders.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{orders.length} orders</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : groupedOrders.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">No orders found</div>
      ) : (
        <div className="space-y-2">
          {groupedOrders.map(([dateKey, dayOrders]) => {
            const isOpen = openDates.has(dateKey);
            const dateObj = parseISO(dateKey);
            const isTodayDate = isToday(dateObj);
            return (
              <div key={dateKey} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleDate(dateKey)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-90')} />
                  <span className="font-semibold text-card-foreground">
                    {format(dateObj, 'EEEE, MMM d, yyyy')}
                    {isTodayDate && <Badge className="ml-2 bg-primary/15 text-primary border-primary/30 text-[10px]">Today</Badge>}
                  </span>
                  <Badge variant="secondary" className="ml-auto">{dayOrders.length}</Badge>
                </button>
                <div className={cn('overflow-hidden transition-all duration-300', isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0')}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-b bg-muted/50">
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">ID</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Customer</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Phone</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Product</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Price</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Agent</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Source</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Status</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayOrders.map((o: any) => {
                          const canChangeStatus = o.source === 'order' || o.source === 'prediction_lead';
                          const isFromLead = o.source_type === 'prediction_lead' || o.source === 'prediction_lead';
                          return (
                          <tr key={o.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", isFromLead && "bg-accent/30")}>
                            <td className="px-4 py-2.5 font-medium text-xs">{o.display_id}</td>
                            <td className="px-4 py-2.5 text-xs">{o.customer_name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{o.customer_phone || '—'}</td>
                            <td className="px-4 py-2.5 text-xs">{o.product_name}</td>
                            <td className="px-4 py-2.5 font-semibold text-primary text-xs">
                              {o.price ? `$${Number(o.price).toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{o.assigned_agent_name || '—'}</td>
                            <td className="px-4 py-2.5 text-xs">
                              <Badge variant={isFromLead ? 'secondary' : 'default'} className="text-[10px]">
                                {isFromLead ? 'Lead' : 'Order'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              {canChangeStatus ? (
                                <Select
                                  value={o.status}
                                  onValueChange={(val) => handleStatusChange(o.id, o.source, val)}
                                  disabled={updatingId === o.id}
                                >
                                  <SelectTrigger className="h-7 w-[110px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="confirmed">
                                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-yellow-500" /> Confirmed</span>
                                    </SelectItem>
                                    <SelectItem value="shipped">
                                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-500" /> Shipped</span>
                                    </SelectItem>
                                    <SelectItem value="delivered">
                                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Delivered</span>
                                    </SelectItem>
                                    <SelectItem value="paid">
                                      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" /> Paid</span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                statusBadge(o.status)
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{format(new Date(o.created_at), 'HH:mm')}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
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
  const isWarehouse = user?.isWarehouse;
  const canManage = isAdmin || isWarehouse;
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
    if (canManage) {
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
      {canManage && (
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
                {canManage && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
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
                  {canManage && (
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
                <tr><td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">No items assigned</td></tr>
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
  const isWarehouse = user?.isWarehouse;
  const canManage = isAdmin || isWarehouse;

  return (
    <AppLayout title="Warehouse">
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          {canManage && <TabsTrigger value="incoming">Incoming Orders</TabsTrigger>}
          <TabsTrigger value="user-warehouse">User Warehouse</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>

        {canManage && (
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
