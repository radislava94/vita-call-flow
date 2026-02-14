import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { mockData } from '@/data/mockData';
import { PredictionEntry, PredictionList, PREDICTION_LEAD_LABELS, PREDICTION_LEAD_COLORS } from '@/types';
import { UserPlus, ArrowLeft, CheckSquare } from 'lucide-react';
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

export default function PredictionListDetail() {
  const { id } = useParams();
  const { toast } = useToast();

  const initialList = mockData.predictionLists.find(l => l.id === id);
  const [list, setList] = useState<PredictionList | undefined>(initialList ? { ...initialList, entries: [...initialList.entries] } : undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);

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
    const unassigned = list.entries.filter(e => !e.assignedAgentId);
    if (selected.size === unassigned.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(unassigned.map(e => e.id)));
    }
  };

  const handleBulkAssign = (agentId: string) => {
    const agent = mockData.agents.find(a => a.id === agentId);
    if (!agent) return;

    setList(prev => {
      if (!prev) return prev;
      const newEntries = prev.entries.map(e =>
        selected.has(e.id) ? { ...e, assignedAgentId: agent.id, assignedAgentName: agent.name } : e
      );
      return {
        ...prev,
        entries: newEntries,
        assignedCount: newEntries.filter(e => e.assignedAgentId).length,
      };
    });

    toast({ title: 'Entries assigned', description: `${selected.size} entries assigned to ${agent.name}` });
    setSelected(new Set());
    setAssignOpen(false);
  };

  const unassignedCount = list.entries.filter(e => !e.assignedAgentId).length;

  return (
    <AppLayout title={list.name}>
      <div className="mb-4">
        <Link to="/predictions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Prediction Lists
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{list.totalRecords} total records</span>
          <span>{list.assignedCount} assigned</span>
          <span>{unassignedCount} unassigned</span>
        </div>
        {selected.size > 0 && (
          <Button onClick={() => setAssignOpen(true)} className="gap-2">
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
            {list.entries.map(entry => (
              <tr key={entry.id} className={cn('border-b last:border-0 transition-colors', selected.has(entry.id) ? 'bg-primary/5' : 'hover:bg-muted/30')}>
                <td className="px-4 py-3">
                  {!entry.assignedAgentId ? (
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
                  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', PREDICTION_LEAD_COLORS[entry.status])}>
                    {PREDICTION_LEAD_LABELS[entry.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.assignedAgentName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {entry.assignedAgentName.charAt(0)}
                      </span>
                      {entry.assignedAgentName}
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
            {mockData.agents.filter(a => a.isActive).map(agent => (
              <button
                key={agent.id}
                onClick={() => handleBulkAssign(agent.id)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {agent.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
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
