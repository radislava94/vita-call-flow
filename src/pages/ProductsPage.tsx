import { useState } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { mockData } from '@/data/mockData';
import { Plus, MoreHorizontal, ToggleLeft, ToggleRight, Package } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState(mockData.products);

  return (
    <AppLayout title="Products">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        <button className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map(product => (
          <div key={product.id} className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <h3 className="mt-3 font-semibold text-card-foreground">{product.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-bold text-primary">${product.price.toFixed(2)}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${product.isActive ? 'text-success' : 'text-muted-foreground'}`}>
                {product.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {product.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
