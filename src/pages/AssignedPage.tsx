import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';
import { Eye, Loader2 } from 'lucide-react';
import { apiGetOrders } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function AssignedPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The backend RLS filters by assigned_agent_id for agents automatically
    apiGetOrders({ limit: 100 })
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // For agents, RLS already filters. For admins viewing this page, filter client-side
  const myOrders = user?.role === 'admin'
    ? orders.filter(o => o.assigned_agent_id === user.id)
    : orders;

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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
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
                <td className="px-4 py-3 font-semibold">${Number(order.price).toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link to={`/orders/${order.id}`} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </td>
              </tr>
            ))}
            {myOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No orders assigned to you.</td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    </AppLayout>
  );
}
