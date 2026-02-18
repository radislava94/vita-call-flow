import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus, canEditOrder } from '@/types';
import { ArrowLeft, User, Package, Clock, MessageSquare, ChevronRight, AlertTriangle, Save, CalendarIcon, Pencil, Loader2, Phone, Plus, Trash2 } from 'lucide-react';
import { isValidPhone } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiGetOrder, apiUpdateCustomer, apiUpdateOrderStatus, apiAddOrderNote, apiGetProducts, apiAddOrderItem, apiUpdateOrderItem, apiDeleteOrderItem } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CallPopup } from '@/components/CallPopup';

const STATUSES_REQUIRING_COMPLETE_INFO: OrderStatus[] = ['confirmed', 'shipped', 'delivered', 'returned', 'paid', 'cancelled'];

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
}

interface LocalItem {
  tempId: string;
  id?: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  isNew?: boolean;
  isDirty?: boolean;
  isDeleted?: boolean;
}

// Helpers
function calcRowTotal(item: LocalItem): number {
  const q = Math.max(1, Math.floor(item.quantity) || 1);
  const p = Math.max(0, Number(item.price_per_unit) || 0);
  return Math.round(q * p * 100) / 100;
}

function calcOrderTotal(items: LocalItem[]): number {
  return items
    .filter(i => !i.isDeleted)
    .reduce((sum, item) => sum + calcRowTotal(item), 0);
}

let tempIdCounter = 0;
function genTempId(): string {
  return `tmp-${Date.now()}-${++tempIdCounter}`;
}

function buildItemsFromOrder(data: any): LocalItem[] {
  const orderItems: OrderItem[] = data.order_items || [];
  if (orderItems.length > 0) {
    return orderItems.map((item) => ({
      tempId: item.id,
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: Number(item.quantity) || 1,
      price_per_unit: Number(item.price_per_unit) || 0,
    }));
  }
  if (data.product_name) {
    return [{
      tempId: 'legacy-' + data.id,
      product_id: data.product_id || null,
      product_name: data.product_name,
      quantity: Number(data.quantity) || 1,
      price_per_unit: Number(data.price) || 0,
    }];
  }
  return [];
}

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [birthday, setBirthday] = useState<Date | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('pending');
  const [statusError, setStatusError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCallPopup, setShowCallPopup] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // Multi-product state
  const [items, setItems] = useState<LocalItem[]>([]);
  const [editingProducts, setEditingProducts] = useState(false);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const loadOrder = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiGetOrder(id)
      .then((data) => {
        setOrder(data);
        setCustomerName(data.customer_name || '');
        setCustomerPhone(data.customer_phone || '');
        setCustomerCity(data.customer_city || '');
        setCustomerAddress(data.customer_address || '');
        setPostalCode(data.postal_code || '');
        setBirthday(data.birthday ? parse(data.birthday, 'yyyy-MM-dd', new Date()) : undefined);
        setSelectedStatus(data.status);
        setItems(buildItemsFromOrder(data));
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadOrder(); }, [loadOrder]);
  useEffect(() => {
    apiGetProducts()
      .then((data) => { setProducts(data); setProductsLoaded(true); })
      .catch(() => setProductsLoaded(true));
  }, []);

  const isEditable = order ? canEditOrder(order.status) : true;
  const phoneDuplicates = order?.phone_duplicates || [];

  const activeItems = useMemo(() => items.filter(i => !i.isDeleted), [items]);
  const orderTotal = useMemo(() => calcOrderTotal(items), [items]);

  const fieldErrors = useMemo(() => {
    if (!editing) return {};
    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.name = 'Name is required';
    if (!customerPhone.trim()) errors.phone = 'Phone is required';
    else if (!isValidPhone(customerPhone)) errors.phone = 'Invalid phone format (8-15 digits)';
    if (!customerCity.trim()) errors.city = 'City is required';
    if (!customerAddress.trim()) errors.address = 'Address is required';
    return errors;
  }, [editing, customerName, customerPhone, customerCity, customerAddress]);

  const hasRequiredFieldsComplete = customerName.trim() && customerPhone.trim() && customerCity.trim() && customerAddress.trim();

  if (loading) {
    return (
      <AppLayout title="Order Details">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout title="Order Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg text-muted-foreground">Order not found</p>
          <Link to="/orders" className="mt-4 text-sm text-primary hover:underline">Back to Orders</Link>
        </div>
      </AppLayout>
    );
  }

  // ── Product handlers ──────────────────────────────────────────

  const handleProductChangeForItem = (tempId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => prev.map(item =>
      item.tempId === tempId
        ? {
            ...item,
            product_id: product.id,
            product_name: product.name,
            price_per_unit: Number(product.price) || 0,
            isDirty: true,
          }
        : item
    ));
    // Clear error for this item
    setItemErrors(prev => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const handleItemFieldChange = (tempId: string, field: 'quantity' | 'price_per_unit', rawValue: string) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      if (field === 'quantity') {
        const parsed = parseInt(rawValue, 10);
        const val = isNaN(parsed) ? 1 : Math.max(1, Math.floor(parsed));
        return { ...item, quantity: val, isDirty: true };
      }
      // price_per_unit
      const parsed = parseFloat(rawValue);
      const val = isNaN(parsed) ? 0 : Math.max(0, parsed);
      return { ...item, price_per_unit: val, isDirty: true };
    }));
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, {
      tempId: genTempId(),
      product_id: null,
      product_name: '',
      quantity: 1,
      price_per_unit: 0,
      isNew: true,
      isDirty: true,
    }]);
  };

  const handleRemoveItem = (tempId: string) => {
    setItems(prev => {
      const target = prev.find(i => i.tempId === tempId);
      if (!target) return prev;
      // If it's a new unsaved item, just remove it from array
      if (!target.id) return prev.filter(i => i.tempId !== tempId);
      // Existing DB item: mark as deleted
      return prev.map(i => i.tempId === tempId ? { ...i, isDeleted: true } : i);
    });
    setItemErrors(prev => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const validateItems = (): boolean => {
    const errors: Record<string, string> = {};
    const active = items.filter(i => !i.isDeleted);

    if (active.length === 0) {
      toast({ title: 'Error', description: 'At least one product is required.', variant: 'destructive' });
      return false;
    }

    for (const item of active) {
      if (!item.product_id && !item.product_name.trim()) {
        errors[item.tempId] = 'Select a product';
      } else if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
        errors[item.tempId] = 'Quantity must be a positive integer';
      } else if (isNaN(item.price_per_unit) || item.price_per_unit < 0) {
        errors[item.tempId] = 'Invalid price';
      } else if (isNaN(calcRowTotal(item)) || calcRowTotal(item) <= 0) {
        errors[item.tempId] = 'Row total must be greater than 0';
      }
    }

    setItemErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({ title: 'Validation error', description: 'Fix highlighted product rows.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSaveProducts = async () => {
    if (!validateItems()) return;

    setSaving(true);
    try {
      // 1. Delete removed items
      const deletedItems = items.filter(i => i.isDeleted && i.id);
      for (const item of deletedItems) {
        await apiDeleteOrderItem(item.id!);
      }

      // 2. Add new items
      const newItems = items.filter(i => !i.isDeleted && i.isNew);
      for (const item of newItems) {
        await apiAddOrderItem(order.id, {
          product_id: item.product_id || undefined,
          product_name: item.product_name,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
        });
      }

      // 3. Update dirty existing items
      const dirtyItems = items.filter(i => !i.isDeleted && i.isDirty && !i.isNew && i.id);
      for (const item of dirtyItems) {
        await apiUpdateOrderItem(item.id!, {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price_per_unit: item.price_per_unit,
        });
      }

      setEditingProducts(false);
      setItemErrors({});
      toast({ title: 'Products saved' });
      loadOrder();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelProductsEdit = () => {
    setItems(buildItemsFromOrder(order));
    setEditingProducts(false);
    setItemErrors({});
  };

  // ── Customer handlers ─────────────────────────────────────────

  const handleSaveCustomer = async () => {
    if (Object.keys(fieldErrors).length > 0) {
      toast({ title: 'Validation error', description: 'Please fix all required fields.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiUpdateCustomer(order.id, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_city: customerCity.trim(),
        customer_address: customerAddress.trim(),
        postal_code: postalCode.trim(),
        birthday: birthday ? format(birthday, 'yyyy-MM-dd') : null,
      });
      setEditing(false);
      toast({ title: 'Order info saved' });
      loadOrder();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setCustomerCity(order.customer_city || '');
    setCustomerAddress(order.customer_address || '');
    setPostalCode(order.postal_code || '');
    setBirthday(order.birthday ? parse(order.birthday, 'yyyy-MM-dd', new Date()) : undefined);
    setEditing(false);
  };

  const handleStatusUpdate = async () => {
    setStatusError('');
    if (STATUSES_REQUIRING_COMPLETE_INFO.includes(selectedStatus) && !hasRequiredFieldsComplete) {
      setStatusError(`Cannot change to "${STATUS_LABELS[selectedStatus]}" — Name, Phone, City, and Address must be filled in first.`);
      return;
    }
    setSaving(true);
    try {
      await apiUpdateOrderStatus(order.id, selectedStatus);
      toast({ title: 'Status updated', description: `Order status changed to ${STATUS_LABELS[selectedStatus]}` });
      loadOrder();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await apiAddOrderNote(order.id, noteText.trim());
      setNoteText('');
      toast({ title: 'Note added' });
      loadOrder();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label: string, value: string, onChange: (v: string) => void, error?: string, mono?: boolean) => (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {editing ? (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
              error && 'border-destructive focus:ring-destructive',
              mono && 'font-mono'
            )}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </>
      ) : (
        <p className={cn('font-medium', mono && 'font-mono text-sm')}>{value || <span className="text-muted-foreground italic">Not set</span>}</p>
      )}
    </div>
  );

  const history = order.history || [];
  const notes = order.notes || [];

  const formatCurrency = (val: number) => {
    const safe = isNaN(val) ? 0 : val;
    return safe.toFixed(2);
  };

  return (
    <AppLayout title={`Order ${order.display_id}`}>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
        <Button
          onClick={() => setShowCallPopup(true)}
          className="ml-auto gap-1.5"
          size="sm"
        >
          <Phone className="h-4 w-4" /> Call Customer
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <User className="h-5 w-5 text-primary" /> Customer Information
              </h2>
              {!editing && isEditable && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {!editing && !isEditable && (
                <p className="text-xs text-muted-foreground italic">Locked — order is Shipped, Delivered, or Paid.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderField('Full Name', customerName, setCustomerName, fieldErrors.name)}

              <div>
                {renderField('Telephone', customerPhone, setCustomerPhone, fieldErrors.phone, true)}
                {phoneDuplicates.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {phoneDuplicates.map((d: any, i: number) => (
                      <p key={i} className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> Duplicate in {d.source}: {d.source_name} ({d.source_id})
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {renderField('City', customerCity, setCustomerCity, fieldErrors.city)}
              {renderField('Address', customerAddress, setCustomerAddress, fieldErrors.address)}
              {renderField('Postal Code', postalCode, setPostalCode)}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Birthday</p>
                {editing ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal h-9', !birthday && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {birthday ? format(birthday, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthday}
                        onSelect={setBirthday}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <p className="font-medium">
                    {birthday ? format(birthday, 'PPP') : <span className="text-muted-foreground italic">Not set</span>}
                  </p>
                )}
              </div>
            </div>

            {editing && (
              <div className="mt-5 flex items-center gap-2 border-t pt-4">
                <Button onClick={handleSaveCustomer} disabled={saving} className="gap-1.5">
                  <Save className="h-4 w-4" /> Save Changes
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
              </div>
            )}
          </div>

          {/* Products in this Order */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <Package className="h-5 w-5 text-primary" /> Products in this Order
              </h2>
              {!editingProducts && isEditable && (
                <Button variant="outline" size="sm" onClick={() => setEditingProducts(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {!editingProducts && !isEditable && (
                <p className="text-xs text-muted-foreground italic">Locked — order is Shipped, Delivered, or Paid.</p>
              )}
            </div>

            {editingProducts ? (
              <div className="space-y-3">
                {activeItems.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">No products. Click "Add Product to Order" below.</p>
                )}

                {activeItems.map((item, idx) => {
                  const selectedProduct = products.find(p => p.id === item.product_id);
                  const rowTotal = calcRowTotal(item);
                  const error = itemErrors[item.tempId];
                  const activeProducts = products.filter(p => p.is_active);

                  return (
                    <div key={item.tempId} className={cn("rounded-lg border p-4 space-y-3", error ? 'border-destructive bg-destructive/5' : 'bg-muted/50')}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Product {idx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.tempId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Product</p>
                        {productsLoaded ? (
                          <Select
                            value={item.product_id || ''}
                            onValueChange={(val) => handleProductChangeForItem(item.tempId, val)}
                          >
                            <SelectTrigger className={cn("w-full", !item.product_id && 'text-muted-foreground')}>
                              <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeProducts.length === 0 ? (
                                <SelectItem value="__none" disabled>No active products</SelectItem>
                              ) : (
                                activeProducts.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span className="flex items-center gap-2">
                                      {p.name} ({p.sku || 'No SKU'})
                                      <span className={cn('text-xs', p.stock_quantity < (p.low_stock_threshold || 5) ? 'text-destructive' : 'text-muted-foreground')}>
                                        — Stock: {p.stock_quantity}
                                      </span>
                                    </span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 flex items-center text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading products...
                          </div>
                        )}
                        {selectedProduct && (
                          <p className="mt-1 text-xs text-muted-foreground">Available stock: {selectedProduct.stock_quantity}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Quantity</p>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={item.quantity}
                            onChange={(e) => handleItemFieldChange(item.tempId, 'quantity', e.target.value)}
                            onBlur={(e) => {
                              // Ensure valid integer on blur
                              const parsed = parseInt(e.target.value, 10);
                              if (isNaN(parsed) || parsed < 1) {
                                handleItemFieldChange(item.tempId, 'quantity', '1');
                              }
                            }}
                            className="h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Price per Unit</p>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.price_per_unit}
                            onChange={(e) => handleItemFieldChange(item.tempId, 'price_per_unit', e.target.value)}
                            onBlur={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (isNaN(parsed) || parsed < 0) {
                                handleItemFieldChange(item.tempId, 'price_per_unit', '0');
                              }
                            }}
                            className="h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">Total</p>
                          <p className="h-9 flex items-center text-sm font-bold text-primary">
                            {formatCurrency(rowTotal)}
                          </p>
                        </div>
                      </div>

                      {error && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {error}
                        </p>
                      )}
                    </div>
                  );
                })}

                <Button variant="outline" onClick={handleAddItem} className="w-full gap-1.5 border-dashed">
                  <Plus className="h-4 w-4" /> Add Product to Order
                </Button>

                <div className="flex items-center justify-between border-t pt-4 mt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Total</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(orderTotal)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSaveProducts} disabled={saving} className="gap-1.5">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={handleCancelProductsEdit} disabled={saving}>Cancel</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activeItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No products in this order.</p>
                ) : (
                  activeItems.map((item) => (
                    <div key={item.tempId} className="rounded-lg bg-muted p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold">{item.product_name || 'Unnamed product'}</p>
                        {item.product_id && (
                          <span className="text-xs text-muted-foreground">
                            Stock: {products.find(p => p.id === item.product_id)?.stock_quantity ?? '—'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Quantity</p>
                          <p className="font-semibold">{item.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Price per Unit</p>
                          <p className="font-semibold">{formatCurrency(item.price_per_unit)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-bold text-primary">{formatCurrency(calcRowTotal(item))}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between px-1 pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Order Total</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(orderTotal)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <MessageSquare className="h-5 w-5 text-primary" /> Internal Notes
            </h2>
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note: any) => (
                  <div key={note.id} className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{note.author_name}</span>
                      <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              className="mt-4 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
            />
            <button
              onClick={handleAddNote}
              disabled={saving || !noteText.trim()}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Add Note
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h2>
            <StatusBadge status={order.status} className="text-sm" />
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value as OrderStatus); setStatusError(''); }}
              className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            {statusError && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {statusError}
              </p>
            )}
            <Button onClick={handleStatusUpdate} disabled={saving} className="mt-2 w-full">
              Update Status
            </Button>
          </div>

          {/* Assignment */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assignment</h2>
            {order.assigned_agent_name ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {order.assigned_agent_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{order.assigned_agent_name}</p>
                  <p className="text-xs text-muted-foreground">Assigned by {order.assigned_by}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned</p>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h2>
            <div className="space-y-3">
              {history.map((change: any, i: number) => {
                const isProductChange = change.from_status === change.to_status &&
                  change.changed_by_name && (change.changed_by_name.includes('Product added') || change.changed_by_name.includes('Product updated') || change.changed_by_name.includes('Product removed'));

                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", isProductChange ? 'bg-accent' : 'bg-primary/10')}>
                      {isProductChange ? <Package className="h-3 w-3 text-accent-foreground" /> : <Clock className="h-3 w-3 text-primary" />}
                    </div>
                    <div>
                      {isProductChange ? (
                        <p className="text-sm">{change.changed_by_name}</p>
                      ) : (
                        <>
                          <p className="text-sm">
                            <span className="font-medium">{change.changed_by_name}</span> changed status
                          </p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs">
                            {change.from_status && <StatusBadge status={change.from_status} />}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <StatusBadge status={change.to_status} />
                          </div>
                        </>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">{new Date(change.changed_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm">Order created</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CallPopup
        open={showCallPopup}
        onClose={() => {
          setShowCallPopup(false);
          loadOrder();
        }}
        contextType="order"
        contextId={order.id}
        customerName={order.customer_name}
        phoneNumber={order.customer_phone}
        productName={activeItems.map(i => i.product_name).filter(Boolean).join(', ') || order.product_name}
      />
    </AppLayout>
  );
}
