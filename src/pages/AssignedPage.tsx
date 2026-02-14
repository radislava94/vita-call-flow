import { AppLayout } from '@/layouts/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { mockData } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';

export default function AssignedPage() {
  // Mock: show orders assigned to first agent
  const myOrders = mockData.orders.filter(o => o.assignedAgentId === 'u1');

  return (
    <AppLayout title="Assigned to Me">
      <p className="mb-4 text-sm text-muted-foreground">{myOrders.length} orders assigned to you</p>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
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
                <td className="px-4 py-3 font-mono text-xs font-semibold">{order.id}</td>
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3">{order.product}</td>
                <td className="px-4 py-3 font-semibold">${order.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link to={`/orders/${order.id}`} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
