import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { mockData } from '@/data/mockData';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import { ArrowLeft, User, Package, Clock, MessageSquare, ChevronRight, AlertTriangle, Save, CalendarIcon, Pencil } from 'lucide-react';
import { normalizePhone, isValidPhone, findDuplicatePhoneInOrders, findDuplicatePhoneInPredictions } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const STATUSES_REQUIRING_COMPLETE_INFO: OrderStatus[] = ['confirmed', 'shipped', 'returned', 'paid', 'cancelled'];

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const order = mockData.orders.find(o => o.id === id);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [customerName, setCustomerName] = useState(order?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(order?.customerPhone ?? '');
  const [customerCity, setCustomerCity] = useState(order?.customerCity ?? '');
  const [customerAddress, setCustomerAddress] = useState(order?.customerAddress ?? '');
  const [postalCode, setPostalCode] = useState(order?.postalCode ?? '');
  const [birthday, setBirthday] = useState<Date | undefined>(
    order?.birthday ? parse(order.birthday, 'yyyy-MM-dd', new Date()) : undefined
  );
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order?.status ?? 'pending');
  const [statusError, setStatusError] = useState('');

  // Phone duplicate checks
  const phoneDuplicates = useMemo(() => {
    if (!order) return [];
    const dupes: string[] = [];
    const phone = editing ? customerPhone : order.customerPhone;
    const norm = normalizePhone(phone);
    const otherOrder = mockData.orders.find(o => o.id !== order.id && normalizePhone(o.customerPhone) === norm);
    if (otherOrder) dupes.push(`Duplicate phone in order ${otherOrder.id}`);
    const predList = findDuplicatePhoneInPredictions(phone);
    if (predList) dupes.push(`Phone exists in prediction list "${predList}"`);
    return dupes;
  }, [editing, customerPhone, order]);

  // Validation for required fields
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

  const handleSaveCustomer = () => {
    if (Object.keys(fieldErrors).length > 0) {
      toast({ title: 'Validation error', description: 'Please fix all required fields.', variant: 'destructive' });
      return;
    }
    // Update mock data in-place
    order.customerName = customerName.trim();
    order.customerPhone = customerPhone.trim();
    order.customerCity = customerCity.trim();
    order.customerAddress = customerAddress.trim();
    order.postalCode = postalCode.trim();
    order.birthday = birthday ? format(birthday, 'yyyy-MM-dd') : null;
    setEditing(false);
    toast({ title: 'Customer info saved' });
  };

  const handleCancelEdit = () => {
    setCustomerName(order.customerName);
    setCustomerPhone(order.customerPhone);
    setCustomerCity(order.customerCity);
    setCustomerAddress(order.customerAddress);
    setPostalCode(order.postalCode);
    setBirthday(order.birthday ? parse(order.birthday, 'yyyy-MM-dd', new Date()) : undefined);
    setEditing(false);
  };

  const handleStatusUpdate = () => {
    setStatusError('');
    if (STATUSES_REQUIRING_COMPLETE_INFO.includes(selectedStatus) && !hasRequiredFieldsComplete) {
      setStatusError(`Cannot change to "${STATUS_LABELS[selectedStatus]}" — Name, Phone, City, and Address must be filled in first.`);
      return;
    }
    order.status = selectedStatus;
    toast({ title: 'Status updated', description: `Order status changed to ${STATUS_LABELS[selectedStatus]}` });
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

  return (
    <AppLayout title={`Order ${order.id}`}>
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-card-foreground">
                <User className="h-5 w-5 text-primary" /> Customer Information
              </h2>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderField('Full Name', customerName, setCustomerName, fieldErrors.name)}

              <div>
                {renderField('Telephone', customerPhone, setCustomerPhone, fieldErrors.phone, true)}
                {phoneDuplicates.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {phoneDuplicates.map((msg, i) => (
                      <p key={i} className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> {msg}
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
                <Button onClick={handleSaveCustomer} className="gap-1.5">
                  <Save className="h-4 w-4" /> Save Changes
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
              </div>
            )}
          </div>

          {/* Product */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <Package className="h-5 w-5 text-primary" /> Product
            </h2>
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <div>
                <p className="font-semibold">{order.product}</p>
                <p className="text-sm text-muted-foreground">ID: {order.productId}</p>
              </div>
              <span className="text-lg font-bold text-primary">${order.price.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <MessageSquare className="h-5 w-5 text-primary" /> Internal Notes
            </h2>
            {order.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {order.notes.map(note => (
                  <div key={note.id} className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{note.author}</span>
                      <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
            <textarea
              placeholder="Add a note..."
              className="mt-4 w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
            />
            <button className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
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
            <Button onClick={handleStatusUpdate} className="mt-2 w-full">
              Update Status
            </Button>
          </div>

          {/* Assignment */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assignment</h2>
            {order.assignedAgent ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {order.assignedAgent.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{order.assignedAgent}</p>
                  <p className="text-xs text-muted-foreground">Assigned by {order.assignedBy}</p>
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
              {order.statusHistory.map((change, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Clock className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{change.changedBy}</span> changed status
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs">
                      <StatusBadge status={change.from} />
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <StatusBadge status={change.to} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{new Date(change.changedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm">Order created</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
