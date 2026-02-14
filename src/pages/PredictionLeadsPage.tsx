import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import {
  PredictionLeadStatus,
  PREDICTION_LEAD_STATUSES,
  PREDICTION_LEAD_LABELS,
  PREDICTION_LEAD_COLORS,
} from '@/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Loader2 } from 'lucide-react';
import { apiGetMyLeads, apiUpdateLead } from '@/lib/api';

interface LeadRow {
  id: string;
  name: string;
  telephone: string;
  address: string | null;
  city: string | null;
  product: string | null;
  status: PredictionLeadStatus;
  notes: string | null;
  prediction_lists?: { name: string } | null;
}

export default function PredictionLeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLeads = () => {
    setLoading(true);
    apiGetMyLeads()
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeads(); }, []);

  const updateStatus = async (id: string, status: PredictionLeadStatus) => {
    try {
      await apiUpdateLead(id, { status });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
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

  if (loading) {
    return (
      <AppLayout title="Prediction Leads">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Prediction Leads">
      <p className="mb-4 text-sm text-muted-foreground">{leads.length} prediction leads assigned to you</p>

      <div className="space-y-3">
        {leads.map(lead => {
          const isExpanded = expandedId === lead.id;
          return (
            <div key={lead.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : lead.id)}
              >
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', PREDICTION_LEAD_COLORS[lead.status])}>
                  {PREDICTION_LEAD_LABELS[lead.status]}
                </span>
                <span className="font-medium">{lead.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{lead.telephone}</span>
                <span className="text-sm text-muted-foreground">{lead.city}</span>
                <span className="ml-auto text-sm text-muted-foreground">{lead.product}</span>
              </div>

              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Address</p>
                      <p>{lead.address || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">City</p>
                      <p>{lead.city || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Product</p>
                      <p>{lead.product || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Telephone</p>
                      <p className="font-mono">{lead.telephone}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {PREDICTION_LEAD_STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(lead.id, s)}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                            lead.status === s
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border hover:bg-muted'
                          )}
                        >
                          {PREDICTION_LEAD_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Notes
                    </p>
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

        {leads.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No prediction leads assigned to you yet.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
