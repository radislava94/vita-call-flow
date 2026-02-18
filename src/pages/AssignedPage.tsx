import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGetOrders } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { OrderModal, OrderModalData } from '@/components/OrderModal';

export default function AssignedPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOrder, setModalOrder] = useState<any>(null);

  const fetchOrders = () => {
    setLoading(true);
    apiGetOrders({ limit: 100 })
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  const myOrders = user?.isAdmin
    ? orders.filter(o => o.assigned_agent_id === user.id)
    : orders;

  function orderToModalData(order: any): OrderModalData {
    return {
      id: order.id,
      displayId: order.display_id,
      name: order.customer_name,
      telephone: order.customer_phone,
      address: order.customer_address,
      city: order.customer_city,
      postalCode: order.postal_code || '',
      product: order.product_name,
      status: order.status,
      notes: null,
      quantity: order.quantity,
      price: order.price,
      assigned_agent_id: order.assigned_agent_id,
      items: (order.order_items || []).map((i: any) => ({
        id: i.id, product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, price_per_unit: i.price_per_unit, total_price: i.total_price,
      })),
    };
  }

  return (
    <AppLayout title="Assigned to Me">
      <p className="mb-4 text-sm text-muted-foreground">{myOrders.length} orders assigned to you</p>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
             <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Price</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {myOrders.map(order => (
              <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 font-mono text-xs font-semibold">{order.display_id}</td>
                <td className="px-4 py-3">{order.customer_name}</td>
                <td className="px-4 py-3">{order.product_name}</td>
                <td className="px-4 py-3 text-center">{order.quantity || 1}</td>
                <td className="px-4 py-3 font-bold text-primary">{((order.quantity || 1) * Number(order.price)).toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setModalOrder(order)}>
                    <Phone className="h-3 w-3" /> Open
                  </Button>
                </td>
              </tr>
            ))}
            {myOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No orders assigned to you.</td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>

      <OrderModal
        open={!!modalOrder}
        onClose={(saved) => {
          setModalOrder(null);
          if (saved) fetchOrders();
        }}
        data={modalOrder ? orderToModalData(modalOrder) : null}
        contextType="order"
      />
    </AppLayout>
  );
}
