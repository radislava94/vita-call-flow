import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import {
  PredictionLeadStatus,
  PREDICTION_LEAD_STATUSES,
  PREDICTION_LEAD_LABELS,
} from '@/types';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X as XIcon, Phone, Search, CalendarIcon, Filter, Tag, HandMetal } from 'lucide-react';
import { format } from 'date-fns';
import { apiGetMyLeads, apiTakeLead } from '@/lib/api';
import { OrderModal, OrderModalData } from '@/components/OrderModal';

interface LeadItem {
  id: string;
  lead_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
}

interface LeadRow {
  id: string;
  name: string;
  telephone: string;
  address: string | null;
  city: string | null;
  product: string | null;
  status: PredictionLeadStatus;
  notes: string | null;
  quantity?: number;
  price?: number;
  created_at?: string;
  updated_at?: string;
  prediction_lists?: { name: string } | null;
  prediction_lead_items?: LeadItem[];
}

const STATUS_CHIP_COLORS: Record<PredictionLeadStatus, string> = {
  not_contacted: 'bg-amber-100 text-amber-800 border-amber-200',
  no_answer: 'bg-violet-100 text-violet-800 border-violet-200',
  interested: 'bg-blue-100 text-blue-800 border-blue-200',
  not_interested: 'bg-rose-100 text-rose-800 border-rose-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function calcRowTotal(qty: number, price: number): number {
  return Math.round(Math.max(1, qty) * Math.max(0, price) * 100) / 100;
}

function getLeadDisplayTotal(lead: LeadRow): number {
  const items = lead.prediction_lead_items || [];
  if (items.length > 0) {
    return items.reduce((sum, i) => sum + calcRowTotal(i.quantity, i.price_per_unit), 0);
  }
  return (lead.quantity || 1) * (lead.price || 0);
}

function leadToModalData(lead: LeadRow): OrderModalData {
  return {
    id: lead.id,
    name: lead.name,
    telephone: lead.telephone,
    address: lead.address,
    city: lead.city,
    product: lead.product,
    status: lead.status,
    notes: lead.notes,
    quantity: lead.quantity,
    price: lead.price,
    items: (lead.prediction_lead_items || []).map(i => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      price_per_unit: i.price_per_unit,
      total_price: i.total_price,
    })),
  };
}

export default function PredictionLeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalLead, setModalLead] = useState<LeadRow | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<PredictionLeadStatus[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchLeads = () => {
    setLoading(true);
    setError(null);
    apiGetMyLeads()
      .then((data) => setLeads(data || []))
      .catch((err) => setError(err.message || 'Failed to load leads'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, []);

  const uniqueProducts = useMemo(() => {
    const prods = new Set<string>();
    leads.forEach(l => { if (l.product) prods.add(l.product); });
    return Array.from(prods).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(s) ||
        l.telephone.includes(s) ||
        l.city?.toLowerCase().includes(s)
      );
    }
    if (selectedStatuses.length > 0) {
      result = result.filter(l => selectedStatuses.includes(l.status));
    }
    if (selectedProduct !== 'all') {
      result = result.filter(l => l.product === selectedProduct);
    }
    if (dateFrom) {
      result = result.filter(l => l.created_at && new Date(l.created_at) >= dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      result = result.filter(l => l.created_at && new Date(l.created_at) <= end);
    }
    return result;
  }, [leads, search, selectedStatuses, selectedProduct, dateFrom, dateTo]);

  const hasActiveFilters = search.trim() || selectedStatuses.length > 0 || selectedProduct !== 'all' || dateFrom || dateTo;

  const clearAllFilters = () => {
    setSearch('');
    setSelectedStatuses([]);
    setSelectedProduct('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const toggleStatus = (status: PredictionLeadStatus) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  if (loading) {
    return (
      <AppLayout title="Prediction Leads">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Prediction Leads">
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchLeads}>Retry</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Prediction Leads">
      {/* Filter Bar */}
      <div className="sticky top-0 z-10 mb-4 space-y-3">
        <div className="rounded-xl border bg-card/80 backdrop-blur-sm p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 text-sm rounded-lg bg-background"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                  <Filter className="h-3.5 w-3.5" />
                  Status
                  {selectedStatuses.length > 0 && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {selectedStatuses.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-1">
                  {PREDICTION_LEAD_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        selectedStatuses.includes(s)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <div className={cn(
                        'h-3.5 w-3.5 rounded border-2 flex items-center justify-center transition-colors',
                        selectedStatuses.includes(s) ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                      )}>
                        {selectedStatuses.includes(s) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium border', STATUS_CHIP_COLORS[s])}>
                        {PREDICTION_LEAD_LABELS[s]}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {uniqueProducts.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                    <Tag className="h-3.5 w-3.5" />
                    {selectedProduct === 'all' ? 'Product' : selectedProduct}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2" align="start">
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setSelectedProduct('all')}
                      className={cn('flex w-full rounded-lg px-3 py-2 text-sm transition-colors', selectedProduct === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted')}
                    >
                      All Products
                    </button>
                    {uniqueProducts.map(p => (
                      <button key={p} onClick={() => setSelectedProduct(p)} className={cn('flex w-full rounded-lg px-3 py-2 text-sm transition-colors', selectedProduct === p ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted')}>
                        {p}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-normal">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, 'MMM d') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
                Clear all
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
              {filteredLeads.length} of {leads.length} leads
            </span>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {selectedStatuses.map(s => (
              <Badge key={s} variant="secondary" className={cn('gap-1 cursor-pointer border text-xs', STATUS_CHIP_COLORS[s])} onClick={() => toggleStatus(s)}>
                {PREDICTION_LEAD_LABELS[s]}
                <XIcon className="h-3 w-3" />
              </Badge>
            ))}
            {selectedProduct !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setSelectedProduct('all')}>
                {selectedProduct}
                <XIcon className="h-3 w-3" />
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setDateFrom(undefined)}>
                From: {format(dateFrom, 'MMM d')}
                <XIcon className="h-3 w-3" />
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setDateTo(undefined)}>
                To: {format(dateTo, 'MMM d')}
                <XIcon className="h-3 w-3" />
              </Badge>
            )}
            {search.trim() && (
              <Badge variant="secondary" className="gap-1 cursor-pointer text-xs" onClick={() => setSearch('')}>
                "{search}"
                <XIcon className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">City</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Product</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map(lead => {
              const items = lead.prediction_lead_items || [];
              const hasItems = items.length > 0;
              const displayTotal = getLeadDisplayTotal(lead);

              return (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border', STATUS_CHIP_COLORS[lead.status])}>
                      {PREDICTION_LEAD_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{lead.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{lead.telephone}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{lead.city || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {hasItems ? `${items.length} product${items.length > 1 ? 's' : ''}` : lead.product || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold font-mono tabular-nums text-primary">
                    {displayTotal.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => setModalLead(lead)}
                      >
                        <Phone className="h-3 w-3" />
                        Open
                      </Button>
                      {lead.status === 'not_contacted' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={async () => {
                            try {
                              await apiTakeLead(lead.id);
                              toast({ title: 'Order taken' });
                              fetchLeads();
                            } catch (err: any) {
                              toast({ title: 'Error', description: err.message, variant: 'destructive' });
                            }
                          }}
                        >
                          <HandMetal className="h-3 w-3" />
                          Take
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No leads found.
                  {hasActiveFilters && (
                    <button onClick={clearAllFilters} className="ml-1 text-primary hover:underline">Clear filters</button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Modal */}
      <OrderModal
        open={!!modalLead}
        onClose={(saved) => {
          setModalLead(null);
          if (saved) fetchLeads();
        }}
        data={modalLead ? leadToModalData(modalLead) : null}
        contextType="prediction_lead"
      />
    </AppLayout>
  );
}
