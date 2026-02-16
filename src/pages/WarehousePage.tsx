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
  apiGetSuppliers,
  apiCreateSupplier,
  apiUpdateSupplier,
  apiDeleteSupplier,
  apiRestock,
  apiGetStockMovements,
  apiUpdateWarehouseOrder,
  apiDeleteWarehouseOrder,
} from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  Loader2,
  Download,
  Plus,
  Trash2,
  Edit,
  UserPlus,
  ChevronRight,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  Truck,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Incoming Orders Tab ───────────────────────────────────────
function IncomingOrdersTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit dialog state
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

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
    apiGetProducts().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => { fetchOrders(); }, [agentFilter, dateFrom, dateTo, sourceFilter, statusFilter]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const o of orders) {
      const dateKey = format(new Date(o.created_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(o);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [orders]);

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
      await apiUpdateWarehouseOrder(orderId, { status: newStatus, _source: source });
      toast({ title: `Status updated to ${newStatus}` });
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const openEditDialog = (order: any) => {
    setEditOrder(order);
    setEditForm({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_address: order.customer_address || '',
      customer_city: order.customer_city || '',
      postal_code: order.postal_code || '',
      birthday: order.birthday || '',
      product_name: order.product_name || '',
      product_id: order.product_id || '',
      quantity: order.quantity || 1,
      price: order.price || 0,
      notes: order.notes || '',
      status: order.status || 'confirmed',
    });
  };

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    setSaving(true);
    try {
      const payload: any = {
        _source: editOrder.source,
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        customer_address: editForm.customer_address,
        customer_city: editForm.customer_city,
        postal_code: editForm.postal_code,
        birthday: editForm.birthday || null,
        product_name: editForm.product_name,
        quantity: parseInt(editForm.quantity) || 1,
        price: parseFloat(editForm.price) || 0,
        notes: editForm.notes,
      };
      if (editForm.product_id && editOrder.source === 'order') {
        payload.product_id = editForm.product_id;
      }
      if (editForm.status !== editOrder.status) {
        payload.status = editForm.status;
      }
      await apiUpdateWarehouseOrder(editOrder.id, payload);
      toast({ title: 'Order updated successfully' });
      setEditOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setEditForm((prev: any) => ({
        ...prev,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
      }));
    }
  };

  const exportCSV = () => {
    if (orders.length === 0) return;
    const headers = ['ID', 'Customer', 'Phone', 'Product', 'Quantity', 'Total Price', 'Agent', 'Source', 'Status', 'Date'];
    const rows = orders.map((o: any) => [
      o.display_id, `"${(o.customer_name || '').replace(/"/g, '""')}"`, o.customer_phone || '',
      `"${(o.product_name || '').replace(/"/g, '""')}"`, o.quantity || 1, ((o.quantity || 1) * Number(o.price || 0)).toFixed(2), o.assigned_agent_name || '',
      o.source === 'prediction_lead' ? 'Prediction Lead' : 'Standard Order', o.status, format(new Date(o.created_at), 'yyyy-MM-dd'),
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

  const allStatuses = [
    { value: 'pending', label: 'Pending', color: 'bg-muted' },
    { value: 'take', label: 'Take', color: 'bg-blue-500' },
    { value: 'call_again', label: 'Call Again', color: 'bg-orange-500' },
    { value: 'confirmed', label: 'Confirmed', color: 'bg-yellow-500' },
    { value: 'shipped', label: 'Shipped', color: 'bg-green-500' },
    { value: 'delivered', label: 'Delivered', color: 'bg-sky-500' },
    { value: 'paid', label: 'Paid', color: 'bg-purple-500' },
    { value: 'returned', label: 'Returned', color: 'bg-red-500' },
    { value: 'trashed', label: 'Trashed', color: 'bg-muted' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-muted' },
  ];

  const statusBadge = (status: string) => {
    const s = allStatuses.find(st => st.value === status);
    return <Badge className={cn("text-white", s?.color || 'bg-muted')}>{s?.label || status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Agents" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a: any) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="order">Standard Orders</SelectItem>
            <SelectItem value="prediction_lead">Prediction Leads</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
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
                <button onClick={() => toggleDate(dateKey)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
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
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Total Price</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Agent</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Source</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Status</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Time</th>
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayOrders.map((o: any) => {
                          const isFromLead = o.source_type === 'prediction_lead' || o.source === 'prediction_lead';
                          return (
                            <tr key={o.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", isFromLead && "bg-accent/30")}>
                              <td className="px-4 py-2.5 font-medium text-xs">{o.display_id}</td>
                              <td className="px-4 py-2.5 text-xs">{o.customer_name}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{o.customer_phone || '—'}</td>
                              <td className="px-4 py-2.5 text-xs">
                                {o.product_name}
                                {o.quantity > 1 && <span className="text-muted-foreground"> x{o.quantity}</span>}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-primary text-xs">{o.price ? ((o.quantity || 1) * Number(o.price)).toFixed(2) : '—'}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{o.assigned_agent_name || '—'}</td>
                              <td className="px-4 py-2.5 text-xs">
                                <Badge variant={isFromLead ? 'secondary' : 'default'} className="text-[10px]">{isFromLead ? 'Lead' : 'Order'}</Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                <Select value={o.status} onValueChange={(val) => handleStatusChange(o.id, o.source, val)} disabled={updatingId === o.id}>
                                  <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {allStatuses.map(s => (
                                      <SelectItem key={s.value} value={s.value}>
                                        <span className="flex items-center gap-1.5">
                                          <span className={cn("h-2 w-2 rounded-full", s.color)} />
                                          {s.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs">{format(new Date(o.created_at), 'HH:mm')}</td>
                              <td className="px-4 py-2.5 flex items-center gap-1">
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEditDialog(o)}>
                                  <Edit className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={deletingId === o.id} onClick={async () => {
                                  if (!confirm(`Delete ${o.display_id}?`)) return;
                                  setDeletingId(o.id);
                                  try {
                                    await apiDeleteWarehouseOrder(o.id, o.source);
                                    toast({ title: 'Deleted' });
                                    fetchOrders();
                                  } catch (err: any) {
                                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                  } finally { setDeletingId(null); }
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
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

      {/* Edit Order Dialog */}
      <Dialog open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit — {editOrder?.display_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={editForm.customer_name} onChange={e => setEditForm((p: any) => ({ ...p, customer_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={editForm.customer_phone} onChange={e => setEditForm((p: any) => ({ ...p, customer_phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Address</label>
              <Input value={editForm.customer_address} onChange={e => setEditForm((p: any) => ({ ...p, customer_address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">City</label>
                <Input value={editForm.customer_city} onChange={e => setEditForm((p: any) => ({ ...p, customer_city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Postal Code</label>
                <Input value={editForm.postal_code} onChange={e => setEditForm((p: any) => ({ ...p, postal_code: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Birthday</label>
              <Input type="date" value={editForm.birthday || ''} onChange={e => setEditForm((p: any) => ({ ...p, birthday: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Product</label>
              <Select value={editForm.product_id || '__custom'} onValueChange={(val) => {
                if (val === '__custom') return;
                handleProductSelect(val);
              }}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom">Custom</SelectItem>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {Number(p.price).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="mt-1" placeholder="Or type product name" value={editForm.product_name} onChange={e => setEditForm((p: any) => ({ ...p, product_name: e.target.value, product_id: '' }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Quantity</label>
                <Input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm((p: any) => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Total Price</label>
                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-semibold text-primary">
                  {(parseFloat(editForm.price || 0) * parseInt(editForm.quantity || 1)).toFixed(2)}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={editForm.status} onValueChange={(val) => setEditForm((p: any) => ({ ...p, status: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allStatuses.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", s.color)} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={editForm.notes} onChange={e => setEditForm((p: any) => ({ ...p, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Inventory Tab (Enhanced) ──────────────────────────────────
function InventoryTab() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || user?.isManager;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestock, setShowRestock] = useState(false);
  const [restockProduct, setRestockProduct] = useState<any>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockInvoice, setRestockInvoice] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchProducts = () => {
    setLoading(true);
    apiGetProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const lowStockProducts = products.filter(p => p.stock_quantity < p.low_stock_threshold);

  const handleRestock = async () => {
    if (!restockProduct || !restockQty) return;
    setSaving(true);
    try {
      await apiRestock({
        product_id: restockProduct.id,
        quantity: parseInt(restockQty),
        supplier_name: restockSupplier,
        invoice_number: restockInvoice,
        notes: restockNotes,
      });
      toast({ title: 'Stock added', description: `Added ${restockQty} units to ${restockProduct.name}` });
      setShowRestock(false);
      setRestockProduct(null);
      setRestockQty(''); setRestockSupplier(''); setRestockInvoice(''); setRestockNotes('');
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openRestock = (p: any) => {
    setRestockProduct(p);
    setRestockQty(''); setRestockSupplier(p.suppliers?.name || ''); setRestockInvoice(''); setRestockNotes('');
    setShowRestock(true);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Low stock alerts */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-destructive text-sm">Low Stock Alerts ({lowStockProducts.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map(p => (
              <Badge key={p.id} variant="destructive" className="text-xs">
                {p.name} — {p.stock_quantity} left (min: {p.low_stock_threshold})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cost</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Min Qty</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              {isAdmin && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => {
              const isLowStock = p.stock_quantity < p.low_stock_threshold;
              return (
                <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", isLowStock && "bg-destructive/5")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isLowStock ? "bg-destructive/10" : "bg-primary/10")}>
                        <Package className={cn("h-4 w-4", isLowStock ? "text-destructive" : "text-primary")} />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.sku || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.suppliers?.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{Number(p.cost_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 font-semibold text-primary">{Number(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {p.stock_quantity <= 0 ? (
                      <Badge variant="destructive">Out of Stock</Badge>
                    ) : isLowStock ? (
                      <Badge variant="destructive">{p.stock_quantity}</Badge>
                    ) : (
                      <Badge className="bg-primary text-primary-foreground">{p.stock_quantity}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.low_stock_threshold}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => openRestock(p)}>
                        <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Restock
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={isAdmin ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">No products</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Restock Dialog */}
      <Dialog open={showRestock} onOpenChange={setShowRestock}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restock — {restockProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Current Stock: {restockProduct?.stock_quantity}</label>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quantity to Add *</label>
              <Input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)} min="1" placeholder="Enter quantity" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Supplier Name</label>
              <Input value={restockSupplier} onChange={e => setRestockSupplier(e.target.value)} placeholder="Supplier name" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Invoice Number</label>
              <Input value={restockInvoice} onChange={e => setRestockInvoice(e.target.value)} placeholder="INV-001" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Input value={restockNotes} onChange={e => setRestockNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestock(false)}>Cancel</Button>
            <Button onClick={handleRestock} disabled={saving || !restockQty}>{saving ? 'Adding...' : 'Add Stock'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stock Movements Tab ───────────────────────────────────────
function StockMovementsTab() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [productFilter, setProductFilter] = useState('');

  useEffect(() => {
    apiGetProducts().then(setProducts).catch(() => {});
  }, []);

  const fetchMovements = () => {
    setLoading(true);
    apiGetStockMovements({
      product_id: productFilter || undefined,
      movement_type: typeFilter || undefined,
      limit: 200,
    }).then(setMovements).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchMovements(); }, [typeFilter, productFilter]);

  const movementIcon = (type: string) => {
    if (type === 'restock') return <ArrowUpCircle className="h-4 w-4 text-emerald-600" />;
    if (type === 'order_deduction') return <ArrowDownCircle className="h-4 w-4 text-destructive" />;
    if (type === 'manual_adjust') return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
    return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
  };

  const movementLabel = (type: string) => {
    if (type === 'restock') return 'Restock';
    if (type === 'order_deduction') return 'Order Deduction';
    if (type === 'manual_adjust') return 'Manual Adjust';
    if (type === 'deduction') return 'Deduction';
    return type || 'Unknown';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="restock">Restock</SelectItem>
            <SelectItem value="order_deduction">Order Deduction</SelectItem>
            <SelectItem value="manual_adjust">Manual Adjust</SelectItem>
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Products" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{movements.length} movements</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Old → New</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m: any) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {movementIcon(m.movement_type || m.reason)}
                      <Badge variant="secondary" className="text-xs">{movementLabel(m.movement_type || m.reason)}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{m.product_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.product_sku || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn("font-semibold", m.change_amount > 0 ? "text-emerald-600" : "text-destructive")}>
                      {m.change_amount > 0 ? '+' : ''}{m.change_amount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.previous_stock} → {m.new_stock}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.user_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[150px] truncate">{m.notes || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No stock movements recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Suppliers Tab ─────────────────────────────────────────────
function SuppliersTab() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || user?.isManager;
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formContact, setFormContact] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = () => {
    setLoading(true);
    apiGetSuppliers().then(setSuppliers).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const resetForm = () => { setFormName(''); setFormEmail(''); setFormPhone(''); setFormAddress(''); setFormContact(''); };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await apiCreateSupplier({ name: formName, email: formEmail, phone: formPhone, address: formAddress, contact_info: formContact });
      toast({ title: 'Supplier created' });
      setShowAdd(false); resetForm(); fetchSuppliers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openEdit = (s: any) => {
    setEditSupplier(s);
    setFormName(s.name); setFormEmail(s.email || ''); setFormPhone(s.phone || '');
    setFormAddress(s.address || ''); setFormContact(s.contact_info || '');
  };

  const handleUpdate = async () => {
    if (!editSupplier) return;
    setSaving(true);
    try {
      await apiUpdateSupplier(editSupplier.id, { name: formName, email: formEmail, phone: formPhone, address: formAddress, contact_info: formContact });
      toast({ title: 'Supplier updated' });
      setEditSupplier(null); resetForm(); fetchSuppliers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteSupplier(id);
      toast({ title: 'Supplier deleted' });
      fetchSuppliers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const inputClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Supplier
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Address</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contact Info</th>
                {isAdmin && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s: any) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      {s.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{s.address || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contact_info || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded-md p-1.5 hover:bg-muted transition-colors" title="Edit">
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="rounded-md p-1.5 hover:bg-muted transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">No suppliers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Supplier Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Supplier name *" className={inputClass} />
            <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email" className={inputClass} />
            <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Phone" className={inputClass} />
            <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Address" className={inputClass} />
            <input value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="Contact info" className={inputClass} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formName.trim()}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Dialog */}
      <Dialog open={!!editSupplier} onOpenChange={open => !open && setEditSupplier(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Supplier name *" className={inputClass} />
            <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email" className={inputClass} />
            <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Phone" className={inputClass} />
            <input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Address" className={inputClass} />
            <input value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="Contact info" className={inputClass} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSupplier(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── User Warehouse Tab ────────────────────────────────────────
function UserWarehouseTab() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || user?.isManager;
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
    apiGetUserWarehouseItems().then(setItems).catch(() => {}).finally(() => setLoading(false));
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
      await apiAssignWarehouseItem({ user_id: formUserId, product_id: formProductId, quantity: parseInt(formQty) || 1, notes: formNotes });
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
      await apiUpdateWarehouseItem(editItem.id, { quantity: parseInt(formQty) || 0, notes: formNotes });
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
                  <td className="px-4 py-3"><Badge className="bg-primary text-primary-foreground">{item.quantity}</Badge></td>
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
                {agents.map((a: any) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={formProductId} onValueChange={setFormProductId}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku || 'No SKU'})</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="Quantity" min="1" />
            <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notes (optional)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || !formUserId || !formProductId}>{saving ? 'Assigning...' : 'Assign'}</Button>
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
  const isAdmin = user?.isAdmin || user?.isManager;
  const isWarehouse = user?.isWarehouse;
  const canManage = isAdmin || isWarehouse;

  return (
    <AppLayout title="Warehouse">
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
          {canManage && <TabsTrigger value="incoming">Incoming Orders</TabsTrigger>}
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="user-warehouse">User Warehouse</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>

        <TabsContent value="movements">
          <StockMovementsTab />
        </TabsContent>

        {canManage && (
          <TabsContent value="incoming">
            <IncomingOrdersTab />
          </TabsContent>
        )}

        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>

        <TabsContent value="user-warehouse">
          <UserWarehouseTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
