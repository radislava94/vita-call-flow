import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Phone, MapPin, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatusBadge } from '@/components/StatusBadge';
import { format } from 'date-fns';

interface CustomerHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  customerPhone: string;
  customerName: string;
}

interface HistoryOrder {
  id: string;
  display_id: string;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  product_name: string;
  price: number;
  status: string;
  created_at: string;
  assigned_agent_name: string | null;
}

interface HistoryLead {
  id: string;
  name: string;
  telephone: string;
  product: string | null;
  status: string;
  created_at: string;
  assigned_agent_name: string | null;
}

export function CustomerHistoryDialog({ open, onClose, customerPhone, customerName }: CustomerHistoryDialogProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [leads, setLeads] = useState<HistoryLead[]>([]);

  useEffect(() => {
    if (!open || !customerPhone) return;
    setLoading(true);

    const normalizedPhone = customerPhone.replace(/[^0-9+]/g, '');
    if (normalizedPhone.length < 6) {
      setLoading(false);
      return;
    }

    Promise.all([
      supabase
        .from('orders')
        .select('id, display_id, customer_name, customer_phone, customer_city, product_name, price, status, created_at, assigned_agent_name')
        .ilike('customer_phone', `%${normalizedPhone.slice(-8)}%`)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('prediction_leads')
        .select('id, name, telephone, product, status, created_at, assigned_agent_name')
        .ilike('telephone', `%${normalizedPhone.slice(-8)}%`)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([ordersRes, leadsRes]) => {
      setOrders((ordersRes.data || []) as HistoryOrder[]);
      setLeads((leadsRes.data || []) as HistoryLead[]);
    }).finally(() => setLoading(false));
  }, [open, customerPhone]);

  const totalOrders = orders.length;
  const totalLeads = leads.length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Customer History
          </DialogTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground pt-1">
            <span className="font-medium text-foreground">{customerName || 'Unknown'}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customerPhone}</span>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-y-auto space-y-4 flex-1">
            {/* Summary */}
            <div className="flex gap-3">
              <Badge variant="secondary" className="text-xs">{totalOrders} order{totalOrders !== 1 ? 's' : ''}</Badge>
              <Badge variant="outline" className="text-xs">{totalLeads} lead{totalLeads !== 1 ? 's' : ''}</Badge>
            </div>

            {/* Orders */}
            {orders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Orders</h3>
                <div className="space-y-1.5">
                  {orders.map(o => (
                    <div key={o.id} className="rounded-lg border bg-card px-3 py-2 text-sm flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold">{o.display_id}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{o.product_name}</span>
                          {o.customer_city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.customer_city}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary text-sm">{Number(o.price).toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(o.created_at), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leads */}
            {leads.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Prediction Leads</h3>
                <div className="space-y-1.5">
                  {leads.map(l => (
                    <div key={l.id} className="rounded-lg border bg-card px-3 py-2 text-sm flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{l.name || 'No name'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                          {l.product && <span>{l.product}</span>}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">{format(new Date(l.created_at), 'MMM d, yyyy')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalOrders === 0 && totalLeads === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No history found for this customer.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
