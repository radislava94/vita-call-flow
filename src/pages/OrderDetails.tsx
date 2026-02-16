import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus, canEditOrder } from '@/types';
import { ArrowLeft, User, Package, Clock, MessageSquare, ChevronRight, AlertTriangle, Save, CalendarIcon, Pencil, Loader2, Phone } from 'lucide-react';
import { isValidPhone } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiGetOrder, apiUpdateCustomer, apiUpdateOrderStatus, apiAddOrderNote, apiGetProducts } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CallPopup } from '@/components/CallPopup';

const STATUSES_REQUIRING_COMPLETE_INFO: OrderStatus[] = ['confirmed', 'shipped', 'delivered', 'returned', 'paid', 'cancelled'];

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingProduct, setEditingProduct] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [birthday, setBirthday] = useState<Date | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('pending');
  const [statusError, setStatusError] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCallPopup, setShowCallPopup] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const loadOrder = () => {
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
        setSelectedProductId(data.product_id || null);
        setSelectedProductName(data.product_name || '');
        setOrderQuantity(data.quantity || 1);
        setOrderPrice(Number(data.price) || 0);
        setSelectedStatus(data.status);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrder(); }, [id]);
  useEffect(() => {
    apiGetProducts().then(setProducts).catch(() => {});
  }, []);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const totalAmount = orderQuantity * orderPrice;
  const isEditable = order ? canEditOrder(order.status) : true;

  const phoneDuplicates = order?.phone_duplicates || [];

  const fieldErrors = useMemo(() => {
    if (!editing) return {};
    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.name = 'Name is required';
    if (!customerPhone.trim()) errors.phone = 'Phone is required';
    else if (!isValidPhone(customerPhone)) errors.phone = 'Invalid phone format (8-15 digits)';
    if (!customerCity.trim()) errors.city = 'City is required';
    if (!customerAddress.trim()) errors.address = 'Address is required';
    if (selectedProductId && selectedProduct && orderQuantity > selectedProduct.stock_quantity) {
      errors.quantity = `Only ${selectedProduct.stock_quantity} available in stock`;
    }
    return errors;
  }, [editing, customerName, customerPhone, customerCity, customerAddress, orderQuantity, selectedProductId, selectedProduct]);

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

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductId(product.id);
      setSelectedProductName(product.name);
      setOrderPrice(Number(product.price) || 0);
      if (orderQuantity > product.stock_quantity) {
        setOrderQuantity(Math.max(1, product.stock_quantity));
      }
    }
  };

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

  const handleSaveProduct = async () => {
    if (!selectedProductName.trim()) {
      toast({ title: 'Validation error', description: 'Product is required.', variant: 'destructive' });
      return;
    }
    if (orderQuantity < 1) {
      toast({ title: 'Validation error', description: 'Quantity must be at least 1.', variant: 'destructive' });
      return;
    }
    if (orderPrice < 0) {
      toast({ title: 'Validation error', description: 'Price must be 0 or more.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiUpdateCustomer(order.id, {
        product_id: selectedProductId,
        product_name: selectedProductName.trim(),
        quantity: orderQuantity,
        price: orderPrice,
      });
      setEditingProduct(false);
      toast({ title: 'Product & pricing saved' });
      loadOrder();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelProductEdit = () => {
    setSelectedProductId(order.product_id || null);
    setSelectedProductName(order.product_name || '');
    setOrderQuantity(order.quantity || 1);
    setOrderPrice(Number(order.price) || 0);
    setEditingProduct(false);
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
                <p className="text-xs text-muted-foreground italic">Product and price locked because order is Shipped, Delivered, or Paid.</p>
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

          {/* Product & Pricing */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <Package className="h-5 w-5 text-primary" /> Product & Pricing
              </h2>
              {!editingProduct && isEditable && (
                <Button variant="outline" size="sm" onClick={() => setEditingProduct(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {!editingProduct && !isEditable && (
                <p className="text-xs text-muted-foreground italic">Locked — order is Shipped, Delivered, or Paid.</p>
              )}
            </div>
            {editingProduct ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Product</p>
                  <Select value={selectedProductId || ''} onValueChange={handleProductChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.is_active).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            {p.name} ({p.sku || 'No SKU'})
                            <span className={cn('text-xs', p.stock_quantity < (p.low_stock_threshold || 5) ? 'text-destructive' : 'text-muted-foreground')}>
                              — Stock: {p.stock_quantity}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-muted-foreground">Available stock: {selectedProduct.stock_quantity}</p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Quantity</p>
                    <input
                      type="number"
                      min={1}
                      max={selectedProduct?.stock_quantity || 100000}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className={cn(
                        'h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                        fieldErrors.quantity && 'border-destructive'
                      )}
                    />
                    {fieldErrors.quantity && <p className="mt-1 text-xs text-destructive">{fieldErrors.quantity}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Price per Unit</p>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-9 w-full rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Total Price</p>
                    <p className="h-9 flex items-center text-lg font-bold text-primary">{totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t pt-4">
                  <Button onClick={handleSaveProduct} disabled={saving} className="gap-1.5">
                    <Save className="h-4 w-4" /> Save Changes
                  </Button>
                  <Button variant="outline" onClick={handleCancelProductEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div>
                    <p className="font-semibold">{order.product_name}</p>
                    {order.product_id && <p className="text-sm text-muted-foreground">ID: {order.product_id}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 px-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-semibold">{order.quantity || 1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Price per Unit</p>
                    <p className="font-semibold">{Number(order.price).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Price</p>
                    <p className="text-lg font-bold text-primary">{((order.quantity || 1) * Number(order.price)).toFixed(2)}</p>
                  </div>
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
              {history.map((change: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{change.changed_by_name}</span> changed status
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs">
                      {change.from_status && <StatusBadge status={change.from_status} />}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <StatusBadge status={change.to_status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{new Date(change.changed_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
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
        productName={order.product_name}
      />
    </AppLayout>
  );
}
