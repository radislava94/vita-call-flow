import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiGetProducts, apiCreateOrder } from '@/lib/api';

interface ProductItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_per_unit: number;
}

interface CreateOrderModalProps {
  open: boolean;
  onClose: (created?: boolean) => void;
}

export function CreateOrderModal({ open, onClose }: CreateOrderModalProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'call_again'>('confirmed');
  const [items, setItems] = useState<ProductItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(''); setPhone(''); setAddress(''); setCity('');
    setPostalCode(''); setNotes(''); setStatus('confirmed');
    setItems([]); setLoading(true);
    apiGetProducts().then(p => {
      setProducts(p || []);
      const first = (p || []).find((x: any) => x.is_active) || p?.[0];
      if (first) {
        setItems([{ product_id: first.id, product_name: first.name, quantity: 1, price_per_unit: Number(first.price) || 0 }]);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  const addItem = () => {
    const p = products.find(x => x.is_active) || products[0];
    if (!p) return;
    setItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity: 1, price_per_unit: Number(p.price) || 0 }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const changeProduct = (idx: number, productId: string) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], product_id: productId, product_name: p.name, price_per_unit: Number(p.price) || 0 };
      return copy;
    });
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalPrice = items.reduce((s, i) => s + Math.max(1, i.quantity) * Math.max(0, i.price_per_unit), 0);

  const handleSave = async () => {
    if (saving) return; // prevent double-submit
    if (!name.trim()) {
      toast({ title: 'Customer name is required', variant: 'destructive' });
      return;
    }
    if (!phone.trim()) {
      toast({ title: 'Phone is required', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Add at least one product', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await apiCreateOrder({
        product_name: items.map(i => i.product_name).join(', '),
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_address: address.trim(),
        customer_city: city.trim(),
        postal_code: postalCode.trim(),
        price: totalPrice,
        quantity: items.reduce((s, i) => s + i.quantity, 0),
        status,
        notes: notes.trim() || undefined,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: Math.max(1, i.quantity),
          price_per_unit: Math.max(0, i.price_per_unit),
        })),
      });
      toast({ title: 'Order created successfully' });
      onClose(true);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={cn(
          'relative w-full max-w-xl bg-card border rounded-xl shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}>
          <button onClick={() => onClose()} className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b px-5 py-3 pr-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-card-foreground text-sm">Create New Order</h2>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Customer Info */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm" placeholder="Customer name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 text-sm font-mono" placeholder="Required" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">City</label>
                  <Input value={city} onChange={e => setCity(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Postal Code</label>
                  <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            </section>

            {/* Status */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</h3>
              <Select value={status} onValueChange={(v) => setStatus(v as 'confirmed' | 'call_again')}>
                <SelectTrigger className="h-8 text-sm w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="call_again">Call Again</SelectItem>
                </SelectContent>
              </Select>
            </section>

            {/* Products */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Products</h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addItem} disabled={loading || products.length === 0}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No products added yet.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                      <Select value={item.product_id || ''} onValueChange={(v) => changeProduct(idx, v)}>
                        <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.filter(p => p.is_active).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground">Qty</label>
                        <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} className="h-7 w-14 text-xs text-center" />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-muted-foreground">Price</label>
                        <Input type="number" min={0} step={0.01} value={item.price_per_unit} onChange={e => updateItem(idx, 'price_per_unit', Math.max(0, parseFloat(e.target.value) || 0))} className="h-7 w-20 text-xs text-right" />
                      </div>
                      <span className="text-xs font-semibold text-primary w-16 text-right">
                        {(Math.max(1, item.quantity) * Math.max(0, item.price_per_unit)).toFixed(2)}
                      </span>
                      <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm" placeholder="Optional notes..." />
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-5 py-3">
            <div className="text-sm font-bold text-primary">Total: {totalPrice.toFixed(2)}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onClose()}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Create Order
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
