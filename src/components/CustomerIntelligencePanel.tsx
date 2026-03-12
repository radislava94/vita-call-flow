import { useState } from 'react';
import { CustomerIntelligence } from '@/hooks/useCustomerIntelligence';
import {
  User, ShoppingCart, DollarSign, RotateCcw, TrendingUp,
  ChevronDown, ChevronUp, Clock, Star, AlertTriangle, Shield,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Props {
  data: CustomerIntelligence | null;
  loading: boolean;
  compact?: boolean;
}

export function LeadQualityBadge({ score, reason }: { score?: string; reason?: string }) {
  if (!score) return null;
  const config = {
    HIGH: { icon: Star, className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'HIGH' },
    MEDIUM: { icon: Shield, className: 'bg-amber-100 text-amber-800 border-amber-200', label: 'MEDIUM' },
    RISK: { icon: AlertTriangle, className: 'bg-rose-100 text-rose-800 border-rose-200', label: 'RISK' },
  }[score] || { icon: Shield, className: 'bg-muted text-muted-foreground', label: score };

  const Icon = config.icon;
  return (
    <span title={reason} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export function CustomerIntelligencePanel({ data, loading, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed p-3 animate-pulse">
        <div className="h-3 bg-muted rounded w-1/3 mb-2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    );
  }

  if (!data?.found) return null;

  const stats = data.stats!;
  const lastOrder = data.last_order;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
            <User className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-card-foreground">Customer Intelligence</span>
          <LeadQualityBadge score={data.quality_score} reason={data.quality_reason} />
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {/* Summary row always visible */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground">Orders</div>
          <div className="text-sm font-bold">{stats.total_orders}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Paid</div>
          <div className="text-sm font-bold text-emerald-600">{stats.paid_orders}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Returned</div>
          <div className="text-sm font-bold text-rose-600">{stats.returned_orders}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Revenue</div>
          <div className="text-sm font-bold text-primary">{stats.lifetime_revenue.toLocaleString()}</div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 pt-1 border-t">
          {/* Last Order */}
          {lastOrder && (
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last Order</h4>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div><span className="text-muted-foreground">ID:</span> <span className="font-mono">{lastOrder.display_id}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium capitalize">{lastOrder.status}</span></div>
                <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{lastOrder.product}</span></div>
                <div><span className="text-muted-foreground">Agent:</span> {lastOrder.agent || '—'}</div>
                <div><span className="text-muted-foreground">Date:</span> {format(new Date(lastOrder.date), 'dd/MM/yyyy')}</div>
                <div><span className="text-muted-foreground">Price:</span> <span className="font-mono">{Number(lastOrder.price).toLocaleString()}</span></div>
              </div>
            </div>
          )}

          {/* Timeline */}
          {data.timeline && data.timeline.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3 w-3" /> Timeline
              </h4>
              <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                {data.timeline.slice(0, 20).map((event, idx) => (
                  <TimelineEvent key={idx} event={event} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event }: { event: any }) {
  const typeLabels: Record<string, string> = {
    lead_created: '📋 Lead Created',
    status_confirmed: '✅ Confirmed',
    status_shipped: '📦 Shipped',
    status_delivered: '🚚 Delivered',
    status_paid: '💰 Paid',
    status_returned: '↩️ Returned',
    status_call_again: '📞 Call Again',
    status_take: '👋 Take',
    status_pending: '⏳ Pending',
    status_trashed: '🗑️ Trashed',
    status_cancelled: '❌ Cancelled',
  };
  const label = typeLabels[event.type] || `📌 ${event.type.replace('status_', '').replace(/_/g, ' ')}`;

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground shrink-0 w-[70px]">
        {format(new Date(event.date), 'dd/MM HH:mm')}
      </span>
      <span className="font-medium">{label}</span>
      {event.agent && <span className="text-muted-foreground ml-auto">by {event.agent}</span>}
    </div>
  );
}
