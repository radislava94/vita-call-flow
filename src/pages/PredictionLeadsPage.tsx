import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import {
  PredictionLeadStatus,
  PREDICTION_LEAD_STATUSES,
  PREDICTION_LEAD_LABELS,
} from '@/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Loader2, Pencil, Check, X as XIcon, Phone, Search, CalendarIcon, Filter, Tag, ShoppingCart, Plus, Trash2, HandMetal } from 'lucide-react';
import { format } from 'date-fns';
import { apiGetMyLeads, apiUpdateLead, apiGetProducts, apiAddLeadItem, apiUpdateLeadItem, apiDeleteLeadItem, apiTakeLead } from '@/lib/api';
import { CallPopup } from '@/components/CallPopup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LeadItem {
  id: string;
  lead_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_per_unit: number;
  total_price: number;
  _isNew?: boolean;
  _isDeleted?: boolean;
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

function calcLeadTotal(items: LeadItem[]): number {
  return items.filter(i => !i._isDeleted).reduce((sum, i) => sum + calcRowTotal(i.quantity, i.price_per_unit), 0);
}

export default function PredictionLeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [callPopupLead, setCallPopupLead] = useState<LeadRow | null>(null);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [localItems, setLocalItems] = useState<Record<string, LeadItem[]>>({});
  const [savingItems, setSavingItems] = useState(false);

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
      .then((data) => {
        setLeads(data || []);
        // Initialize local items from server data
        const itemsMap: Record<string, LeadItem[]> = {};
        for (const lead of data || []) {
          if (lead.prediction_lead_items?.length) {
            itemsMap[lead.id] = lead.prediction_lead_items;
          }
        }
        setLocalItems(itemsMap);
      })
      .catch((err) => {
        console.error('Failed to load prediction leads:', err);
        setError(err.message || 'Failed to load leads');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, []);
  useEffect(() => { apiGetProducts().then(setProductsList).catch(() => {}); }, []);

  // Derived data
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

  // Lead CRUD
  const updateStatus = async (id: string, status: PredictionLeadStatus) => {
    try {
      await apiUpdateLead(id, { status });
      fetchLeads();
      toast({ title: 'Status updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const updateNotes = (id: string, notes: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l));
  };

  const saveNotes = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    try {
      await apiUpdateLead(id, { notes: lead.notes || '' });
      toast({ title: 'Notes saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const startEdit = (id: string, field: string, currentValue: string | null) => {
    setEditingField({ id, field });
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const { id, field } = editingField;
    try {
      await apiUpdateLead(id, { [field]: editValue });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, [field]: editValue } : l));
      toast({ title: 'Updated successfully' });
      setEditingField(null);
      setEditValue('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const isEditing = (id: string, field: string) =>
    editingField?.id === id && editingField?.field === field;

  // ── Multi-product item management ──
  const getLeadItems = (leadId: string): LeadItem[] => {
    return localItems[leadId] || [];
  };

  const addProductRow = async (leadId: string) => {
    if (!productsList.length) return;
    const defaultProduct = productsList.find(p => p.is_active) || productsList[0];
    try {
      const newItem = await apiAddLeadItem(leadId, {
        product_id: defaultProduct.id,
        product_name: defaultProduct.name,
        quantity: 1,
        price_per_unit: Number(defaultProduct.price) || 0,
      });
      setLocalItems(prev => ({
        ...prev,
        [leadId]: [...(prev[leadId] || []), newItem],
      }));
      toast({ title: 'Product added' });
    } catch (err: any) {
      toast({ title: 'Error adding product', description: err.message, variant: 'destructive' });
    }
  };

  const updateItemField = async (itemId: string, leadId: string, field: string, value: any) => {
    // Update locally first for instant feedback
    setLocalItems(prev => {
      const items = [...(prev[leadId] || [])];
      const idx = items.findIndex(i => i.id === itemId);
      if (idx >= 0) {
        items[idx] = { ...items[idx], [field]: value };
        // Recalculate total_price
        items[idx].total_price = calcRowTotal(items[idx].quantity, items[idx].price_per_unit);
      }
      return { ...prev, [leadId]: items };
    });
  };

  const saveItemField = async (itemId: string, leadId: string, updates: Record<string, any>) => {
    try {
      await apiUpdateLeadItem(itemId, updates);
    } catch (err: any) {
      toast({ title: 'Error saving', description: err.message, variant: 'destructive' });
    }
  };

  const handleItemProductChange = async (itemId: string, leadId: string, productId: string) => {
    const product = productsList.find(p => p.id === productId);
    if (!product) return;
    const updates = { product_id: productId, product_name: product.name, price_per_unit: Number(product.price) };
    updateItemField(itemId, leadId, 'product_id', productId);
    setLocalItems(prev => {
      const items = [...(prev[leadId] || [])];
      const idx = items.findIndex(i => i.id === itemId);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updates, total_price: calcRowTotal(items[idx].quantity, Number(product.price)) };
      }
      return { ...prev, [leadId]: items };
    });
    try {
      await apiUpdateLeadItem(itemId, updates);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const removeItemRow = async (itemId: string, leadId: string) => {
    try {
      await apiDeleteLeadItem(itemId);
      setLocalItems(prev => ({
        ...prev,
        [leadId]: (prev[leadId] || []).filter(i => i.id !== itemId),
      }));
      toast({ title: 'Product removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Legacy single-product handler (for leads without items)
  const handleProductSelect = async (leadId: string, productId: string) => {
    const product = productsList.find(p => p.id === productId);
    if (!product) return;
    try {
      await apiUpdateLead(leadId, { product: product.name, price: Number(product.price) });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, product: product.name, price: Number(product.price) } : l));
      toast({ title: 'Product updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleLeadFieldSave = async (leadId: string, field: string, value: number) => {
    try {
      await apiUpdateLead(leadId, { [field]: value });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const renderEditableField = (lead: LeadRow, field: 'address' | 'city' | 'telephone', label: string) => {
    const value = lead[field];
    if (isEditing(lead.id, field)) {
      return (
        <div>
          <p className="text-muted-foreground text-xs mb-1">{label}</p>
          <div className="flex items-center gap-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <button onClick={saveEdit} className="p-1 text-primary hover:bg-primary/10 rounded">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={cancelEdit} className="p-1 text-destructive hover:bg-destructive/10 rounded">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <p className="text-muted-foreground text-xs mb-1">{label}</p>
        <div className="flex items-center gap-1 group">
          <p className={field === 'telephone' ? 'font-mono' : ''}>{value || '—'}</p>
          <button
            onClick={() => startEdit(lead.id, field, value)}
            className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity rounded"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  // Calculate lead total: use items if they exist, otherwise legacy single product
  const getLeadDisplayTotal = (lead: LeadRow): number => {
    const items = getLeadItems(lead.id);
    if (items.length > 0) {
      return calcLeadTotal(items);
    }
    return (lead.quantity || 1) * (lead.price || 0);
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
      {/* ══════ Filter Bar ══════ */}
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

      {/* ══════ Leads List ══════ */}
      <div className="space-y-3">
        {filteredLeads.map(lead => {
          const isExpanded = expandedId === lead.id;
          const items = getLeadItems(lead.id);
          const hasItems = items.length > 0;
          const displayTotal = getLeadDisplayTotal(lead);

          return (
            <div key={lead.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : lead.id)}
              >
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0', STATUS_CHIP_COLORS[lead.status])}>
                  {PREDICTION_LEAD_LABELS[lead.status]}
                </span>
                <span className="font-medium truncate">{lead.name}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{lead.telephone}</span>
                <span className="text-sm text-muted-foreground truncate hidden sm:inline">{lead.city}</span>
                <span className="text-sm text-muted-foreground truncate hidden md:inline">
                  {hasItems ? `${items.length} product${items.length > 1 ? 's' : ''}` : lead.product}
                </span>
                <span className="text-sm font-bold font-mono ml-auto shrink-0 tabular-nums text-right">
                  {displayTotal.toFixed(2)}
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setCallPopupLead(lead); }}
                      className="flex items-center gap-2 flex-1 rounded-lg bg-primary text-primary-foreground py-2.5 font-medium text-sm hover:bg-primary/90 transition-colors justify-center"
                    >
                      <Phone className="h-4 w-4" />
                      Start Call
                    </button>
                    {lead.status === 'not_contacted' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await apiTakeLead(lead.id);
                            toast({ title: 'Order taken' });
                            fetchLeads();
                          } catch (err: any) {
                            toast({ title: 'Error', description: err.message, variant: 'destructive' });
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 px-4 font-medium text-sm hover:bg-emerald-700 transition-colors justify-center"
                      >
                        <HandMetal className="h-4 w-4" />
                        Take Order
                      </button>
                    )}
                  </div>

                  {/* Customer Info */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Customer Info</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {renderEditableField(lead, 'address', 'Address')}
                      {renderEditableField(lead, 'city', 'City')}
                      {renderEditableField(lead, 'telephone', 'Telephone')}
                    </div>
                  </div>

                  {/* Products & Pricing */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ShoppingCart className="h-3 w-3" /> Products & Pricing
                    </h4>
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      {/* Product rows */}
                      {hasItems ? (
                        <>
                          {/* Header */}
                          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                            <div className="col-span-4">Product</div>
                            <div className="col-span-2 text-right">Unit Price</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-3 text-right">Total</div>
                            <div className="col-span-1"></div>
                          </div>
                          {items.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center py-1">
                              <div className="col-span-4">
                                <Select
                                  value={item.product_id || ''}
                                  onValueChange={(val) => handleItemProductChange(item.id, lead.id, val)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder={item.product_name || 'Select'} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {productsList.filter(p => p.is_active).map(p => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.price_per_unit}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    updateItemField(item.id, lead.id, 'price_per_unit', val);
                                  }}
                                  onBlur={() => saveItemField(item.id, lead.id, { price_per_unit: item.price_per_unit, quantity: item.quantity })}
                                  className="h-8 text-xs text-right tabular-nums"
                                />
                              </div>
                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    updateItemField(item.id, lead.id, 'quantity', val);
                                  }}
                                  onBlur={() => saveItemField(item.id, lead.id, { quantity: item.quantity, price_per_unit: item.price_per_unit })}
                                  className="h-8 text-xs text-center"
                                />
                              </div>
                              <div className="col-span-3 text-right font-mono text-sm tabular-nums font-medium">
                                {calcRowTotal(item.quantity, item.price_per_unit).toFixed(2)}
                              </div>
                              <div className="col-span-1 flex justify-center">
                                <button
                                  onClick={() => removeItemRow(item.id, lead.id)}
                                  className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        /* Legacy single-product view */
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Product</p>
                            <Select
                              value={productsList.find(p => p.name === lead.product)?.id || ''}
                              onValueChange={(val) => handleProductSelect(lead.id, val)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder={lead.product || 'Select product'} />
                              </SelectTrigger>
                              <SelectContent>
                                {productsList.filter(p => p.is_active).map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Unit Price</p>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={lead.price || 0}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, price: val } : l));
                              }}
                              onBlur={(e) => handleLeadFieldSave(lead.id, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                              className="h-8 text-sm text-right"
                            />
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Quantity</p>
                            <Input
                              type="number"
                              min={1}
                              value={lead.quantity || 1}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, quantity: val } : l));
                              }}
                              onBlur={(e) => handleLeadFieldSave(lead.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {/* Add Product button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addProductRow(lead.id)}
                        className="w-full mt-2 gap-1.5 text-xs border-dashed"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Product
                      </Button>

                      {/* Payment Summary */}
                      <div className="border-t pt-3 mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Subtotal ({hasItems ? items.length : 1} item{(hasItems ? items.length : 1) > 1 ? 's' : ''})</span>
                          <span className="font-mono tabular-nums">{displayTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-dashed">
                          <span>Final Total</span>
                          <span className="text-primary font-mono text-base tabular-nums">
                            {displayTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Update Status</h4>
                    <div className="flex flex-wrap gap-2">
                      {PREDICTION_LEAD_STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(lead.id, s)}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                            lead.status === s
                              ? STATUS_CHIP_COLORS[s] + ' border-transparent ring-2 ring-primary/30'
                              : 'border-border hover:bg-muted'
                          )}
                        >
                          {PREDICTION_LEAD_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Notes
                    </h4>
                    <Textarea
                      value={lead.notes || ''}
                      onChange={(e) => updateNotes(lead.id, e.target.value)}
                      onBlur={() => saveNotes(lead.id)}
                      placeholder="Add notes about this lead..."
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredLeads.length === 0 && leads.length > 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No leads match your filters.
            <button onClick={clearAllFilters} className="ml-1 text-primary hover:underline">Clear filters</button>
          </div>
        )}

        {leads.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No prediction leads assigned to you yet.
          </div>
        )}
      </div>

      <CallPopup
        open={!!callPopupLead}
        onClose={(saved) => {
          if (saved) fetchLeads();
          setCallPopupLead(null);
        }}
        contextType="prediction_lead"
        lead={callPopupLead}
      />
    </AppLayout>
  );
}
