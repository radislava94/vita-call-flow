import { Order, User, Product, OrderStatus } from '@/types';

const agents: User[] = [
  { id: 'u1', name: 'Sarah Miller', email: 'sarah@vitacall.com', role: 'agent', isActive: true, lastLogin: '2026-02-14T09:30:00Z', totalProcessed: 234 },
  { id: 'u2', name: 'James Wilson', email: 'james@vitacall.com', role: 'agent', isActive: true, lastLogin: '2026-02-14T08:15:00Z', totalProcessed: 189 },
  { id: 'u3', name: 'Emily Chen', email: 'emily@vitacall.com', role: 'agent', isActive: true, lastLogin: '2026-02-13T17:00:00Z', totalProcessed: 312 },
  { id: 'u4', name: 'Admin User', email: 'admin@vitacall.com', role: 'admin', isActive: true, lastLogin: '2026-02-14T10:00:00Z', totalProcessed: 0 },
  { id: 'u5', name: 'David Park', email: 'david@vitacall.com', role: 'agent', isActive: false, lastLogin: '2026-01-20T14:00:00Z', totalProcessed: 78 },
];

const products: Product[] = [
  { id: 'p1', name: 'VitaBoost Pro', description: 'Premium multivitamin supplement', price: 49.99, isActive: true },
  { id: 'p2', name: 'OmegaPlus 3-6-9', description: 'Essential fatty acid complex', price: 34.99, isActive: true },
  { id: 'p3', name: 'CollagenFlex', description: 'Joint & skin support formula', price: 59.99, isActive: true },
  { id: 'p4', name: 'ImmunShield', description: 'Immune system booster', price: 29.99, isActive: true },
  { id: 'p5', name: 'SleepWell Caps', description: 'Natural sleep aid capsules', price: 24.99, isActive: false },
];

const statuses: OrderStatus[] = ['pending', 'take', 'call_again', 'confirmed', 'shipped', 'returned', 'paid', 'trashed', 'cancelled'];

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString();
}

const orders: Order[] = Array.from({ length: 50 }, (_, i) => {
  const product = products[Math.floor(Math.random() * products.length)];
  const agent = Math.random() > 0.2 ? agents[Math.floor(Math.random() * 3)] : null;
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  return {
    id: `ORD-${String(1000 + i).padStart(5, '0')}`,
    product: product.name,
    productId: product.id,
    customerName: ['Ahmed Ben Ali', 'Fatima Zahra', 'Mohamed Salah', 'Leila Khoury', 'Omar Farooq', 'Nadia Bouzid', 'Youssef Hamdi', 'Amira Talbi'][Math.floor(Math.random() * 8)],
    customerPhone: `+212 6${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    customerCity: ['Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tangier', 'Agadir'][Math.floor(Math.random() * 6)],
    customerAddress: `${Math.floor(Math.random() * 200) + 1} Rue ${['Hassan II', 'Mohammed V', 'Atlas', 'Sahara', 'Palmeraie'][Math.floor(Math.random() * 5)]}`,
    postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
    price: product.price,
    status,
    assignedAgent: agent?.name ?? null,
    assignedAgentId: agent?.id ?? null,
    assignedAt: agent ? randomDate(7) : null,
    assignedBy: agent ? 'Admin User' : null,
    createdAt: randomDate(14),
    notes: Math.random() > 0.5 ? [{ id: `n${i}`, text: 'Customer requested callback in the afternoon.', author: agent?.name ?? 'System', createdAt: randomDate(3) }] : [],
    statusHistory: [{ from: 'pending' as OrderStatus, to: status, changedBy: agent?.name ?? 'System', changedAt: randomDate(5) }],
  };
});

export const mockData = { orders, agents: agents.filter(a => a.role === 'agent'), users: agents, products };
