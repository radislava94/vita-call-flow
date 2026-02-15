import { useState, useEffect } from 'react';
import { Phone, PhoneOff, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCallScript, apiUpdateCallScript, apiLogCall, apiGetCallLogs } from '@/lib/api';

export type CallOutcome = 'no_answer' | 'interested' | 'not_interested' | 'wrong_number' | 'call_again';

const OUTCOME_CONFIG: { value: CallOutcome; label: string; className: string }[] = [
  { value: 'no_answer', label: 'No Answer', className: 'border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950' },
  { value: 'interested', label: 'Interested', className: 'border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950' },
  { value: 'not_interested', label: 'Not Interested', className: 'border-rose-500/50 text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950' },
  { value: 'wrong_number', label: 'Wrong Number', className: 'border-slate-500/50 text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-950' },
  { value: 'call_again', label: 'Call Again', className: 'border-blue-500/50 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950' },
];

interface CallPopupProps {
  open: boolean;
  onClose: (outcome?: CallOutcome) => void;
  contextType: 'prediction_lead' | 'order';
  contextId: string;
  customerName: string;
  phoneNumber: string;
  productName?: string;
}

export function CallPopup({ open, onClose, contextType, contextId, customerName, phoneNumber, productName }: CallPopupProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [script, setScript] = useState('');
  const [editingScript, setEditingScript] = useState(false);
  const [editedScript, setEditedScript] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingScript, setLoadingScript] = useState(true);
  const [callLogs, setCallLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setCallNotes('');
    setEditingScript(false);
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
  }, [open, contextType, contextId]);

  const personalizedScript = script
    .replace(/\[Customer Name\]/g, customerName || '___')
    .replace(/\[Product\]/g, productName || '___')
    .replace(/\[Order ID\]/g, contextId.slice(0, 8));

  const handleOutcome = async (outcome: CallOutcome) => {
    setSaving(true);
    try {
      await apiLogCall({
        context_type: contextType,
        context_id: contextId,
        outcome,
        notes: callNotes.trim(),
      });
      toast({ title: 'Call logged', description: `Outcome: ${OUTCOME_CONFIG.find(o => o.value === outcome)?.label}` });
      onClose(outcome);
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
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" />

      {/* Slide-in panel */}
      <div className={cn(
        'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l shadow-2xl flex flex-col',
        'animate-in slide-in-from-right duration-300'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-card-foreground">{customerName || 'Unknown'}</h2>
              <a
                href={`tel:${phoneNumber}`}
                className="text-sm font-mono text-primary hover:underline"
              >
                {phoneNumber}
              </a>
            </div>
          </div>
          {/* No X close button — must select an action */}
        </div>

        {/* Dialer link */}
        <div className="px-5 py-3 border-b">
          <a
            href={`tel:${phoneNumber}`}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground py-2.5 font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Call {phoneNumber}
          </a>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Call Script */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Call Script
              </h3>
              {isAdmin && !editingScript && (
                <button
                  onClick={() => { setEditedScript(script); setEditingScript(true); }}
                  className="text-xs text-primary hover:underline"
                >
                  Edit Script
                </button>
              )}
            </div>

            {loadingScript ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : editingScript ? (
              <div className="space-y-2">
                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  className="min-h-[200px] text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveScript}>Save Script</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingScript(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {personalizedScript || 'No script configured.'}
              </div>
            )}
          </div>

          {/* Product info */}
          {productName && (
            <div className="rounded-lg bg-muted/30 border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Product</p>
              <p className="text-sm font-medium">{productName}</p>
            </div>
          )}

          {/* Call Notes */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Call Notes</h3>
            <Textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Add notes about this call..."
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Previous Call Logs */}
          {callLogs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Previous Calls</h3>
              <div className="space-y-2">
                {callLogs.slice(0, 5).map((log: any) => (
                  <div key={log.id} className="rounded-lg bg-muted/30 border p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{log.outcome.replace(/_/g, ' ')}</span>
                      <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.notes && <p className="mt-1 text-muted-foreground">{log.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons — sticky at bottom */}
        <div className="border-t px-5 py-4 space-y-3 bg-card">
          <p className="text-xs font-medium text-muted-foreground text-center">Select call outcome to close</p>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOME_CONFIG.map(({ value, label, className }) => (
              <button
                key={value}
                onClick={() => handleOutcome(value)}
                disabled={saving}
                className={cn(
                  'rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
                  className
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
