import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Phone, User, ShoppingCart, FileSpreadsheet, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

async function searchPrediction(q: string, token: string) {
  const res = await fetch(`${API_BASE}/search-prediction?q=${encodeURIComponent(q)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

import { supabase } from '@/integrations/supabase/client';

export default function SearchPredictionPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ orders: any[]; leads: any[]; order_history: any[] } | null>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const data = await searchPrediction(q, session.access_token);
      setResults(data);
      if (!data.orders.length && !data.leads.length) {
        toast.info('No results found');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      shipped: 'bg-blue-100 text-blue-800',
      delivered: 'bg-emerald-100 text-emerald-800',
      returned: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      trashed: 'bg-gray-200 text-gray-600',
      take: 'bg-purple-100 text-purple-800',
      call_again: 'bg-orange-100 text-orange-800',
      paid: 'bg-teal-100 text-teal-800',
      not_contacted: 'bg-gray-100 text-gray-700',
      no_answer: 'bg-yellow-100 text-yellow-700',
      interested: 'bg-blue-100 text-blue-700',
      not_interested: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-muted text-muted-foreground';
  };

  const isAdmin = user?.isAdmin || user?.isManager;

  return (
    <AppLayout title="Search Prediction">
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone, name, or order ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Phone search normalizes numbers — formats like 078319044, +38978319044, 38978319044 all match the same record.
        </p>

        {results && (
          <div className="space-y-6">
            {/* Orders */}
            {results.orders.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" /> Orders ({results.orders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {results.orders.map((order) => {
                    const history = results.order_history.filter(h => h.order_id === order.id);
                    return (
                      <div key={order.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm">{order.display_id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(order.status)}`}>
                              {order.status}
                            </span>
                            {!order.is_owned && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">View Only</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div><User className="inline h-3 w-3 mr-1" />{order.customer_name || '—'}</div>
                          <div><Phone className="inline h-3 w-3 mr-1" />{order.customer_phone || '—'}</div>
                          <div>Product: {order.order_items?.length > 0
                            ? order.order_items.map((i: any) => `${i.product_name} x${i.quantity}`).join(', ')
                            : order.product_name}</div>
                          <div>Agent: {order.assigned_agent_name || 'Unassigned'}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Source: {order.source_type || 'manual'}
                        </div>
                        {/* Status History */}
                        {history.length > 0 && (
                          <div className="mt-2 border-t pt-2">
                            <div className="text-xs font-medium mb-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Status History
                            </div>
                            <div className="space-y-1">
                              {history.map((h) => (
                                <div key={h.id} className="text-xs text-muted-foreground flex gap-2">
                                  <span>{format(new Date(h.changed_at), 'dd/MM HH:mm')}</span>
                                  <span>
                                    {h.from_status && <><span className={`px-1 rounded ${statusColor(h.from_status)}`}>{h.from_status}</span> → </>}
                                    <span className={`px-1 rounded ${statusColor(h.to_status)}`}>{h.to_status}</span>
                                  </span>
                                  {h.changed_by_name && <span>by {h.changed_by_name}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Prediction Leads */}
            {results.leads.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" /> Prediction Leads ({results.leads.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {results.leads.map((lead) => (
                    <div key={lead.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{lead.name || '—'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                          {!lead.is_owned && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">View Only</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div><Phone className="inline h-3 w-3 mr-1" />{lead.telephone}</div>
                        <div>Product: {lead.product || '—'}</div>
                        <div>Agent: {lead.assigned_agent_name || 'Unassigned'}</div>
                        <div>List: {lead.prediction_lists?.name || '—'}</div>
                      </div>
                      {lead.notes && (
                        <div className="text-xs text-muted-foreground">Notes: {lead.notes}</div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {results.orders.length === 0 && results.leads.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No results found for "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}