import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { PREDICTION_LEAD_LABELS, PREDICTION_LEAD_COLORS } from '@/types';
import { UserPlus, ArrowLeft, CheckSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiGetPredictionList, apiGetAgents, apiAssignLeads } from '@/lib/api';

interface LeadEntry {
  id: string;
  name: string;
  telephone: string;
  city: string | null;
  product: string | null;
  status: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
}

interface Agent {
  user_id: string;
  full_name: string;
  email: string;
}

export default function PredictionListDetail() {
  const { id } = useParams();
  const { toast } = useToast();

  const [list, setList] = useState<any>(null);
  const [entries, setEntries] = useState<LeadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  const fetchList = () => {
    if (!id) return;
    setLoading(true);
    apiGetPredictionList(id)
      .then((data) => {
        setList(data);
        setEntries(data.entries || []);
      })
      .catch(() => setList(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchList(); }, [id]);

  const openAssign = () => {
    apiGetAgents().then(setAgents).catch(() => {});
    setAssignOpen(true);
  };

  if (loading) {
    return (
      <AppLayout title="Prediction List">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!list) {
    return (
      <AppLayout title="Prediction List">
        <p className="text-muted-foreground">List not found.</p>
      </AppLayout>
    );
  }

  const toggleSelect = (entryId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(entryId) ? next.delete(entryId) : next.add(entryId);
      return next;
    });
  };

  const toggleAll = () => {
    const unassigned = entries.filter(e => !e.assigned_agent_id);
    if (selected.size === unassigned.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unassigned.map(e => e.id)));
    }
  };

  const handleBulkAssign = async (agentId: string) => {
    try {
      await apiAssignLeads(id!, agentId, Array.from(selected));
      toast({ title: 'Entries assigned' });
      setSelected(new Set());
      setAssignOpen(false);
      fetchList();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const unassignedCount = entries.filter(e => !e.assigned_agent_id).length;

  return (
    <AppLayout title={list.name}>
      <div className="mb-4">
        <Link to="/predictions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Prediction Lists
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{list.total_records} total records</span>
          <span>{list.assigned_count} assigned</span>
          <span>{unassignedCount} unassigned</span>
        </div>
        {selected.size > 0 && (
          <Button onClick={openAssign} className="gap-2">
            <UserPlus className="h-4 w-4" /> Assign {selected.size} Selected
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left">
                <button onClick={toggleAll} className="flex items-center justify-center">
                  <CheckSquare className={cn('h-4 w-4', selected.size > 0 ? 'text-primary' : 'text-muted-foreground')} />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telephone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">City</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id} className={cn('border-b last:border-0 transition-colors', selected.has(entry.id) ? 'bg-primary/5' : 'hover:bg-muted/30')}>
                <td className="px-4 py-3">
                  {!entry.assigned_agent_id ? (
                    <input
                      type="checkbox"
                      checked={selected.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                      className="h-4 w-4 rounded border-muted-foreground accent-primary"
                    />
                  ) : (
                    <span className="h-4 w-4 block" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{entry.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{entry.telephone}</td>
                <td className="px-4 py-3">{entry.city}</td>
                <td className="px-4 py-3">{entry.product}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', PREDICTION_LEAD_COLORS[entry.status as keyof typeof PREDICTION_LEAD_COLORS] || '')}>
                    {PREDICTION_LEAD_LABELS[entry.status as keyof typeof PREDICTION_LEAD_LABELS] || entry.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.assigned_agent_name ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {entry.assigned_agent_name.charAt(0)}
                      </span>
                      {entry.assigned_agent_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Agent</DialogTitle>
            <DialogDescription>Select an agent to assign {selected.size} entries to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {agents.map(agent => (
              <button
                key={agent.user_id}
                onClick={() => handleBulkAssign(agent.user_id)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {agent.full_name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-medium">{agent.full_name}</p>
                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
