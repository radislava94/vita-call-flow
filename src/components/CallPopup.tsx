import { useState, useEffect } from 'react';
import { Phone, FileText, Loader2, X, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCallScript, apiUpdateCallScript, apiLogCall, apiGetCallLogs } from '@/lib/api';

export type CallOutcome = 'no_answer' | 'interested' | 'not_interested' | 'wrong_number' | 'call_again';

const OUTCOME_CONFIG: { value: CallOutcome; label: string; className: string }[] = [
  { value: 'call_again', label: 'Call Again', className: 'border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950' },
  { value: 'interested', label: 'Interested', className: 'border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950' },
  { value: 'not_interested', label: 'Not Interested', className: 'border-rose-500/50 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950' },
  { value: 'wrong_number', label: 'Wrong Number', className: 'border-slate-500/50 text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950' },
  { value: 'no_answer', label: 'No Answer', className: 'border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'not_contacted', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'no_answer', label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  { value: 'interested', label: 'Interested', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-rose-100 text-rose-800' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-violet-100 text-violet-800' },
];

interface CallPopupProps {
  open: boolean;
  onClose: (outcome?: CallOutcome, statusOverride?: string) => void;
  contextType: 'prediction_lead' | 'order';
  contextId: string;
  customerName: string;
  phoneNumber: string;
  productName?: string;
  currentStatus?: string;
}

export function CallPopup({ open, onClose, contextType, contextId, customerName, phoneNumber, productName, currentStatus }: CallPopupProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  const [script, setScript] = useState('');
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingScript, setLoadingScript] = useState(true);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus || 'not_contacted');
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCallNotes('');
    setEditingScript(false);
    setSelectedOutcome(null);
    setSelectedStatus(currentStatus || 'not_contacted');
    setShowScript(false);
    setLoadingScript(true);

    Promise.all([
      apiGetCallScript(contextType),
      apiGetCallLogs(contextType, contextId),
    ])
      .then(([scriptData, logs]) => {
        setScript(scriptData?.script_text || '');
        setCallLogs(logs || []);
      })
      .catch(() => {})
      .finally(() => setLoadingScript(false));
  }, [open, contextType, contextId, currentStatus]);

  const personalizedScript = script
    .replace(/\[Customer Name\]/g, customerName || '___')
    .replace(/\[Product\]/g, productName || '___')
    .replace(/\[Order ID\]/g, contextId.slice(0, 8));

  const handleSave = async () => {
    if (!selectedOutcome) {
      toast({ title: 'Select an outcome', description: 'Please select a call outcome before saving.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiLogCall({
        context_type: contextType,
        context_id: contextId,
        outcome: selectedOutcome,
        notes: callNotes.trim(),
      });
      toast({ title: 'Saved successfully', description: `Outcome: ${OUTCOME_CONFIG.find(o => o.value === selectedOutcome)?.label}` });
      onClose(selectedOutcome, selectedStatus);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScript = async () => {
    try {
      await apiUpdateCallScript(contextType, editedScript);
      setScript(editedScript);
      setEditingScript(false);
      toast({ title: 'Call script updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => onClose()} />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={cn(
          'relative w-full max-w-lg bg-card border rounded-xl shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}>
          {/* Close button */}
          <button
            onClick={() => onClose()}
            className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b px-5 py-4 pr-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-card-foreground truncate">{customerName || 'Unknown'}</h2>
              <a href={`tel:${phoneNumber}`} className="text-sm font-mono text-primary hover:underline">
                {phoneNumber}
              </a>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Outcome Buttons */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Call Outcome</h3>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOME_CONFIG.map(({ value, label, className }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedOutcome(value)}
                    className={cn(
                      'rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all',
                      selectedOutcome === value
                        ? className + ' ring-2 ring-primary/40 shadow-sm'
                        : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Dropdown */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status</h3>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', opt.color)}>
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Call Notes</h3>
              <Textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Add notes about this call..."
                className="min-h-[70px] text-sm"
              />
            </div>

            {/* Toggle Script */}
            <div>
              <button
                onClick={() => setShowScript(!showScript)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {showScript ? 'Hide Script' : 'Show Script'}
                {showScript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {showScript && (
                <div className="mt-2">
                  {loadingScript ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : editingScript ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedScript}
                        onChange={(e) => setEditedScript(e.target.value)}
                        className="min-h-[150px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveScript}>Save Script</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingScript(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                      {personalizedScript || 'No script configured.'}
                      {isAdmin && (
                        <button
                          onClick={() => { setEditedScript(script); setEditingScript(true); }}
                          className="block mt-2 text-xs text-primary hover:underline"
                        >
                          Edit Script
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Previous Call Logs */}
            {callLogs.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Previous Calls</h3>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                  {callLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="rounded-lg bg-muted/30 border p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{log.outcome.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.notes && <p className="mt-0.5 text-muted-foreground">{log.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer with Save */}
          <div className="border-t px-5 py-3 flex items-center justify-end gap-2 bg-card rounded-b-xl">
            <Button variant="outline" size="sm" onClick={() => onClose()}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !selectedOutcome}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
