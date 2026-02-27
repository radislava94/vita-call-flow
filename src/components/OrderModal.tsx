import { useState, useEffect } from 'react';
import {
  Phone, FileText, Loader2, X, ChevronDown, ChevronUp, Save,
  Plus, Trash2, ShoppingCart, CalendarIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGetCallScript, apiUpdateCallScript, apiLogCall, apiGetCallLogs,
  apiUpdateLead, apiGetProducts, apiAddLeadItem, apiUpdateLeadItem, apiDeleteLeadItem,
  apiUpdateCustomer, apiUpdateOrderStatus, apiSyncOrderItems,
  apiGetOrder,
} from '@/lib/api';
import { format } from 'date-fns';

export type CallOutcome = 'no_answer' | 'interested' | 'not_interested' | 'wrong_number' | 'call_again';

const OUTCOME_CONFIG: { value: CallOutcome; label: string; className: string }[] = [
  { value: 'call_again', label: 'Call Again', className: 'border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950' },
  { value: 'interested', label: 'Interested', className: 'border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950' },
  { value: 'not_interested', label: 'Not Interested', className: 'border-rose-500/50 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950' },
  { value: 'wrong_number', label: 'Wrong Number', className: 'border-slate-500/50 text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950' },
  { value: 'no_answer', label: 'No Answer', className: 'border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'not_contacted', label: 'Taken', color: 'bg-sky-100 text-sky-800' },
  { value: 'no_answer', label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  { value: 'interested', label: 'Interested', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-violet-100 text-violet-800' },
  { value: 'not_interested', label: 'Cancelled', color: 'bg-rose-100 text-rose-800' },
];

const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'take', label: 'Take', color: 'bg-blue-100 text-blue-800' },
  { value: 'call_again', label: 'Call Again', color: 'bg-gray-100 text-gray-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'shipped', label: 'Shipped', color: 'bg-green-100 text-green-800' },
  { value: 'delivered', label: 'Delivered', color: 'bg-sky-100 text-sky-800' },
  { value: 'returned', label: 'Returned', color: 'bg-rose-100 text-rose-800' },
  { value: 'paid', label: 'Paid', color: 'bg-purple-100 text-purple-800' },
  { value: 'trashed', label: 'Trashed', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

interface ItemLocal {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  _isNew?: boolean;
  _deleted?: boolean;
}

/** Universal data shape that both lead and order can provide */
export interface OrderModalData {
  id: string;
  name: string;
  telephone: string;
  address: string | null;
  city: string | null;
  postalCode?: string | null;
  product: string | null;
  status: string;
  notes: string | null;
  quantity?: number;
  price?: number;
  displayId?: string;
  items?: ItemLocal[];
  assigned_agent_id?: string | null;
}

export type OrderModalContextType = 'prediction_lead' | 'order';

interface OrderModalProps {
  open: boolean;
  onClose: (saved?: boolean) => void;
  data: OrderModalData | null;
  contextType: OrderModalContextType;
  readOnly?: boolean;
}

function calcRowTotal(qty: number, price: number): number {
  return Math.round(Math.max(1, qty) * Math.max(0, price) * 100) / 100;
}

export function OrderModal({ open, onClose, data, contextType, readOnly = false }: OrderModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || user?.isManager;
  const isLead = contextType === 'prediction_lead';
  const statusOptions = isLead ? LEAD_STATUS_OPTIONS : ORDER_STATUS_OPTIONS;
  const isEditable = !readOnly;

  // Script
  const [script, setScript] = useState('');
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [loadingScript, setLoadingScript] = useState(true);
  const [callLogs, setCallLogs] = useState<any[]>([]);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();

  // Products
  const [items, setItems] = useState<ItemLocal[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Payment
  const [amountPaid, setAmountPaid] = useState(0);

  // Saving
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !data) return;

    setCustomerName(data.name || '');
    setCustomerPhone(data.telephone || '');
    setCustomerAddress(data.address || '');
    setCustomerCity(data.city || '');
    setPostalCode(data.postalCode || '');
    setCallNotes(data.notes || '');
    setSelectedOutcome(null);
    setSelectedStatus(data.status || (isLead ? 'not_contacted' : 'pending'));
    setFollowUpDate(undefined);
    setShowScript(false);
    setEditingScript(false);
    setAmountPaid(0);
    setItems([]);

    setLoadingScript(true);
    setLoadingProducts(true);

    // For orders, always fetch full order with items from backend to avoid stale/missing items
    const fetchOrderData = !isLead
      ? apiGetOrder(data.id).catch(() => null)
      : Promise.resolve(null);

    Promise.all([
      apiGetCallScript(contextType).catch(() => null),
      apiGetCallLogs(contextType, data.id).catch(() => []),
      apiGetProducts().catch(() => []),
      fetchOrderData,
    ])
      .then(([scriptData, logs, products, fullOrder]) => {
        setScript(scriptData?.script_text || '');
        setCallLogs(logs || []);
        setProductsList(products || []);
        setLoadingProducts(false);

        // Determine items: for orders use fetched order_items, for leads use passed data
        let resolvedItems: ItemLocal[] = [];
        if (!isLead && fullOrder?.order_items?.length > 0) {
          resolvedItems = fullOrder.order_items.map((i: any) => ({
            id: i.id,
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            price_per_unit: Number(i.price_per_unit),
            total_price: Number(i.total_price),
          }));
        } else if (data.items && data.items.length > 0) {
          resolvedItems = data.items.map(i => ({ ...i }));
        } else if (data.product) {
          // Legacy fallback: only use if no items exist at all
          resolvedItems = [{
            id: '__legacy__',
            product_id: null,
            product_name: data.product || '',
            quantity: data.quantity || 1,
            price_per_unit: data.price || 0,
            total_price: calcRowTotal(data.quantity || 1, data.price || 0),
          }];
        }
        setItems(resolvedItems);
      })
      .catch(() => { setLoadingProducts(false); })
      .finally(() => setLoadingScript(false));
  }, [open, data, contextType]);

  // Computed totals
  const activeItems = items.filter(i => !i._deleted);
  const subtotal = activeItems.reduce((sum, i) => sum + calcRowTotal(i.quantity, i.price_per_unit), 0);
  const finalTotal = Math.round(subtotal * 100) / 100;
  const remainingBalance = Math.max(0, Math.round((finalTotal - amountPaid) * 100) / 100);

  // Product helpers
  const addProductRow = () => {
    const defaultProduct = productsList.find(p => p.is_active) || productsList[0];
    if (!defaultProduct) return;
    setItems(prev => [...prev, {
      id: `_new_${Date.now()}`,
      product_id: defaultProduct.id,
      product_name: defaultProduct.name,
      quantity: 1,
      price_per_unit: Number(defaultProduct.price) || 0,
      total_price: Number(defaultProduct.price) || 0,
      _isNew: true,
    }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      copy[idx].total_price = calcRowTotal(copy[idx].quantity, copy[idx].price_per_unit);
      return copy;
    });
  };

  const changeItemProduct = (idx: number, productId: string) => {
    const product = productsList.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        product_id: productId,
        product_name: product.name,
        price_per_unit: Number(product.price) || 0,
        total_price: calcRowTotal(copy[idx].quantity, Number(product.price) || 0),
      };
      return copy;
    });
  };

  const removeItem = (idx: number) => {
    setItems(prev => {
      const copy = [...prev];
      if (copy[idx]._isNew || copy[idx].id === '__legacy__') {
        copy.splice(idx, 1);
      } else {
        copy[idx] = { ...copy[idx], _deleted: true };
      }
      return copy;
    });
  };

  const personalizedScript = script
    .replace(/\[Customer Name\]/g, customerName || '___')
    .replace(/\[Product\]/g, activeItems[0]?.product_name || '___')
    .replace(/\[Order ID\]/g, data?.displayId || data?.id?.slice(0, 8) || '___');

  // ── SAVE ──
  const handleSave = async () => {
    if (!data) return;
    if (!selectedOutcome) {
      toast({ title: 'Select an outcome', description: 'Please select a call outcome before saving.', variant: 'destructive' });
      return;
    }
    if (selectedOutcome === 'call_again' && !followUpDate) {
      toast({ title: 'Follow-up date required', description: 'Please select a follow-up date for Call Again.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // 1. Log call
      await apiLogCall({
        context_type: contextType,
        context_id: data.id,
        outcome: selectedOutcome,
        notes: callNotes.trim(),
      });

      // 2. Update entity fields
      if (isLead) {
        await apiUpdateLead(data.id, {
          status: selectedStatus,
          notes: callNotes.trim(),
          address: customerAddress,
          city: customerCity,
          telephone: customerPhone,
        });
      } else {
        // Order: update customer info + status
        await apiUpdateCustomer(data.id, {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_address: customerAddress.trim(),
          customer_city: customerCity.trim(),
          postal_code: postalCode.trim(),
        });
        if (selectedStatus !== data.status) {
          await apiUpdateOrderStatus(data.id, selectedStatus);
        }
      }

      // 3. Sync products
      if (isLead) {
        // Lead: individual item operations
        for (const item of items) {
          const isLegacy = item.id === '__legacy__';
          const isNew = item._isNew || isLegacy;
          if (item._deleted && !isNew) {
            await apiDeleteLeadItem(item.id);
          } else if (isNew && !item._deleted) {
            await apiAddLeadItem(data.id, {
              product_id: item.product_id || undefined,
              product_name: item.product_name,
              quantity: item.quantity,
              price_per_unit: item.price_per_unit,
            });
          } else if (!isNew && !item._deleted) {
            await apiUpdateLeadItem(item.id, {
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              price_per_unit: item.price_per_unit,
            });
          }
        }
      } else {
        // Order: atomic sync – overwrite all items, backend recalculates totals
        await apiSyncOrderItems(data.id, activeItems.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          price_per_unit: i.price_per_unit,
        })));
      }

      toast({ title: 'Saved successfully' });
      onClose(true);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScript = async () => {
    try {
      await apiUpdateCallScript(contextType, editedScript);
      setScript(editedScript);
      setEditingScript(false);
      toast({ title: 'Call script updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (!open || !data) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => onClose()} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={cn(
          'relative w-full max-w-2xl bg-card border rounded-xl shadow-2xl flex flex-col max-h-[92vh] pointer-events-auto',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}>
          {/* Close */}
          <button
            onClick={() => onClose()}
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b px-5 py-3 pr-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-card-foreground text-sm truncate">
                 Order Editor {data.displayId ? `— ${data.displayId}` : ''}
                 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(View Only)</span>}
               </h2>
              <a href={`tel:${customerPhone}`} className="text-xs font-mono text-primary hover:underline">
                {customerPhone}
              </a>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* A) Customer Info */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-8 text-sm" disabled={!isEditable} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                  <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-8 text-sm font-mono" disabled={!isEditable} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                  <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="h-8 text-sm" disabled={!isEditable} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">City</label>
                  <Input value={customerCity} onChange={e => setCustomerCity(e.target.value)} className="h-8 text-sm" disabled={!isEditable} />
                </div>
                {!isLead && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Postal Code</label>
                    <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} className="h-8 text-sm" disabled={!isEditable} />
                  </div>
                )}
              </div>
            </section>

            {/* B) Call Outcome */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Call Outcome</h3>
              <div className="grid grid-cols-3 gap-2">
                {OUTCOME_CONFIG.map(({ value, label, className }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedOutcome(value)}
                    className={cn(
                      'rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all',
                      selectedOutcome === value
                        ? className + ' ring-2 ring-primary/40 shadow-sm'
                        : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* Follow-up date */}
            {selectedOutcome === 'call_again' && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Follow-up Date *</h3>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm w-full justify-start font-normal">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {followUpDate ? format(followUpDate, 'PPP') : 'Select date...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={followUpDate}
                      onSelect={setFollowUpDate}
                      disabled={(date) => date < new Date()}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </section>
            )}

            {/* C) Status Dropdown */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</h3>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', opt.color)}>
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* D) Products */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ShoppingCart className="h-3 w-3" /> Products
              </h3>
              <div className="rounded-lg border bg-card p-3 space-y-2">
                {activeItems.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-medium text-muted-foreground pb-1 border-b uppercase tracking-wider">
                    <div className="col-span-4">Product</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-3 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                )}

                {items.map((item, idx) => {
                  if (item._deleted) return null;
                  return (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <Select
                          value={item.product_id || ''}
                          onValueChange={(val) => changeItemProduct(idx, val)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder={item.product_name || 'Select'} />
                          </SelectTrigger>
                          <SelectContent>
                            {productsList.filter(p => p.is_active).map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.price_per_unit}
                          onChange={e => updateItem(idx, 'price_per_unit', Math.max(0, parseFloat(e.target.value) || 0))}
                          className="h-7 text-xs text-right tabular-nums"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-7 text-xs text-center"
                        />
                      </div>
                      <div className="col-span-3 text-right font-mono text-xs tabular-nums font-medium">
                        {calcRowTotal(item.quantity, item.price_per_unit).toFixed(2)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-0.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addProductRow}
                  disabled={loadingProducts || productsList.length === 0}
                  className="w-full gap-1.5 text-xs border-dashed h-7"
                >
                  <Plus className="h-3 w-3" />
                  Add Product
                </Button>
              </div>
            </section>

            {/* E) Payment Summary */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Summary</h3>
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal ({activeItems.length} item{activeItems.length !== 1 ? 's' : ''})</span>
                  <span className="font-mono tabular-nums">{subtotal.toFixed(2)}</span>
                </div>

                <div className="border-t border-dashed pt-2 flex justify-between text-sm font-bold">
                  <span>Final Total</span>
                  <span className="text-primary font-mono tabular-nums text-base">{finalTotal.toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground shrink-0">Amount Paid</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountPaid}
                    onChange={e => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-7 w-28 text-xs text-right ml-auto"
                  />
                </div>
                {amountPaid > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Remaining Balance</span>
                    <span className={cn('font-mono tabular-nums font-medium', remainingBalance > 0 ? 'text-destructive' : 'text-emerald-600')}>
                      {remainingBalance.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
              <Textarea
                value={callNotes}
                onChange={e => setCallNotes(e.target.value)}
                placeholder="Add notes..."
                className="min-h-[60px] text-sm"
              />
            </section>

            {/* Script Toggle */}
            <section>
              <button
                onClick={() => setShowScript(!showScript)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {showScript ? 'Hide Script' : 'Show Script'}
                {showScript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showScript && (
                <div className="mt-2">
                  {loadingScript ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : editingScript ? (
                    <div className="space-y-2">
                      <Textarea value={editedScript} onChange={e => setEditedScript(e.target.value)} className="min-h-[120px] text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveScript}>Save Script</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingScript(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                      {personalizedScript || 'No script configured.'}
                      {isAdmin && (
                        <button onClick={() => { setEditedScript(script); setEditingScript(true); }} className="block mt-2 text-xs text-primary hover:underline">
                          Edit Script
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Previous Calls */}
            {callLogs.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Previous Calls</h3>
                <div className="space-y-1 max-h-[100px] overflow-y-auto">
                  {callLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="rounded bg-muted/30 border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{log.outcome.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.notes && <p className="mt-0.5 text-muted-foreground">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-5 py-3 flex items-center justify-end gap-2 bg-card rounded-b-xl">
            <Button variant="outline" size="sm" onClick={() => onClose()}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !selectedOutcome}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
