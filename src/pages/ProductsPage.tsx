import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Plus, MoreHorizontal, ToggleLeft, ToggleRight, Package, Loader2 } from 'lucide-react';
import { apiGetProducts, apiCreateProduct, apiUpdateProduct } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchProducts = () => {
    setLoading(true);
    apiGetProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await apiCreateProduct({ name: formName, description: formDesc, price: parseFloat(formPrice) || 0 });
      toast({ title: 'Product created' });
      setShowAdd(false);
      setFormName(''); setFormDesc(''); setFormPrice('');
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: ProductRow) => {
    try {
      await apiUpdateProduct(product.id, { is_active: !product.is_active });
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout title="Products">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        <button onClick={() => setShowAdd(true)} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map(product => (
          <div key={product.id} className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <button
                onClick={() => toggleActive(product)}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <h3 className="mt-3 font-semibold text-card-foreground">{product.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{product.description || 'No description'}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-bold text-primary">${Number(product.price).toFixed(2)}</span>
              <button
                onClick={() => toggleActive(product)}
                className={`inline-flex items-center gap-1 text-xs font-medium ${product.is_active ? 'text-success' : 'text-muted-foreground'}`}
              >
                {product.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {product.is_active ? 'Active' : 'Disabled'}
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <input value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="Price" type="number" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
