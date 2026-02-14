import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { mockData } from '@/data/mockData';
import { ALL_STATUSES, STATUS_LABELS, OrderStatus } from '@/types';
import { ArrowLeft, User, MapPin, Phone, Package, Clock, MessageSquare, ChevronRight } from 'lucide-react';

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const order = mockData.orders.find(o => o.id === id);

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
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-card-foreground">
              <User className="h-5 w-5 text-primary" /> Customer Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{order.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">City</p>
                <p className="font-medium">{order.customerCity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium">{order.customerAddress}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Postal Code</p>
                <p className="font-medium">{order.postalCode}</p>
              </div>
            </div>
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
            <select className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {ALL_STATUSES.map(s => (
                <option key={s} value={s} selected={s === order.status}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Update Status
            </button>
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
