import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { Plus, Package, Loader2, Edit, History } from 'lucide-react';
import { apiGetProducts, apiCreateProduct, apiUpdateProduct, apiGetInventoryLogs } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
}

interface InventoryLog {
  id: string;
  change_amount: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  created_at: string;
}

function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty <= 0) return <Badge variant="destructive">Out of Stock</Badge>;
  if (qty < threshold) return <Badge variant="destructive">{qty}</Badge>;
  if (qty === threshold) return <Badge className="bg-accent text-accent-foreground border-accent">{qty}</Badge>;
  return <Badge className="bg-primary text-primary-foreground">{qty}</Badge>;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [logsProduct, setLogsProduct] = useState<ProductRow | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formThreshold, setFormThreshold] = useState('5');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const fetchProducts = () => {
    setLoading(true);
    apiGetProducts()
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormPrice(''); setFormSku(''); setFormStock('0'); setFormThreshold('5');
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await apiCreateProduct({
        name: formName, description: formDesc, price: parseFloat(formPrice) || 0,
        sku: formSku || null, stock_quantity: parseInt(formStock) || 0, low_stock_threshold: parseInt(formThreshold) || 5,
      });
      toast({ title: 'Product created' });
      setShowAdd(false); resetForm(); fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openEdit = (p: ProductRow) => {
    setEditProduct(p);
    setFormName(p.name); setFormDesc(p.description || ''); setFormPrice(String(p.price));
    setFormSku(p.sku || ''); setFormStock(String(p.stock_quantity)); setFormThreshold(String(p.low_stock_threshold));
  };

  const handleUpdate = async () => {
    if (!editProduct) return;
    setSaving(true);
    try {
      await apiUpdateProduct(editProduct.id, {
        name: formName, description: formDesc, price: parseFloat(formPrice) || 0,
        sku: formSku || null, stock_quantity: parseInt(formStock) || 0, low_stock_threshold: parseInt(formThreshold) || 5,
        is_active: editProduct.is_active,
      });
      toast({ title: 'Product updated' });
      setEditProduct(null); resetForm(); fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const toggleActive = async (product: ProductRow) => {
    try {
      await apiUpdateProduct(product.id, { is_active: !product.is_active });
      fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openLogs = async (p: ProductRow) => {
    setLogsProduct(p);
    setLogsLoading(true);
    try {
      const data = await apiGetInventoryLogs(p.id);
      setLogs(data);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  };

  const inputClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppLayout title="Products">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        {isAdmin && (
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Product
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.description || 'No description'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{product.sku || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-primary">${Number(product.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <StockBadge qty={product.stock_quantity} threshold={product.low_stock_threshold} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openLogs(product)} className="rounded-md p-1.5 hover:bg-muted transition-colors" title="Inventory logs">
                        <History className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {isAdmin && (
                        <>
                          <button onClick={() => openEdit(product)} className="rounded-md p-1.5 hover:bg-muted transition-colors" title="Edit">
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => toggleActive(product)} className="rounded-md p-1.5 hover:bg-muted transition-colors text-xs font-medium text-muted-foreground" title="Toggle active">
                            {product.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No products yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name *" className={inputClass} />
            <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="Price" type="number" className={inputClass} />
              <input value={formSku} onChange={e => setFormSku(e.target.value)} placeholder="SKU (auto if empty)" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Stock Quantity</label>
                <input value={formStock} onChange={e => setFormStock(e.target.value)} type="number" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Low Stock Threshold</label>
                <input value={formThreshold} onChange={e => setFormThreshold(e.target.value)} type="number" className={inputClass} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editProduct} onOpenChange={open => !open && setEditProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name *" className={inputClass} />
            <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="Price" type="number" className={inputClass} />
              <input value={formSku} onChange={e => setFormSku(e.target.value)} placeholder="SKU" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Stock Quantity</label>
                <input value={formStock} onChange={e => setFormStock(e.target.value)} type="number" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Low Stock Threshold</label>
                <input value={formThreshold} onChange={e => setFormThreshold(e.target.value)} type="number" className={inputClass} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Logs Dialog */}
      <Dialog open={!!logsProduct} onOpenChange={open => !open && setLogsProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Inventory Logs – {logsProduct?.name}</DialogTitle></DialogHeader>
          {logsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No inventory changes recorded</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <span className={`font-semibold ${log.change_amount > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                    </span>
                    <span className="ml-2 text-muted-foreground">{log.previous_stock} → {log.new_stock}</span>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">{log.reason}</Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
