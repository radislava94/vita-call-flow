import { useState } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { mockData } from '@/data/mockData';
import {
  PredictionEntry,
  PredictionLeadStatus,
  PREDICTION_LEAD_STATUSES,
  PREDICTION_LEAD_LABELS,
  PREDICTION_LEAD_COLORS,
} from '@/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Save } from 'lucide-react';

export default function PredictionLeadsPage() {
  const { toast } = useToast();

  // Flatten all prediction entries assigned to agent u1
  const initialLeads = mockData.predictionLists
    .flatMap(l => l.entries)
    .filter(e => e.assignedAgentId === 'u1');

  const [leads, setLeads] = useState<PredictionEntry[]>(initialLeads);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateStatus = (id: string, status: PredictionLeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    toast({ title: 'Status updated' });
  };

  const updateNotes = (id: string, notes: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l));
  };

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
                      <p>{lead.city}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Product</p>
                      <p>{lead.product}</p>
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
                      value={lead.notes}
                      onChange={(e) => updateNotes(lead.id, e.target.value)}
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
