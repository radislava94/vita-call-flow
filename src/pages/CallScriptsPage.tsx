import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { FileText, Save, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiGetCallScript, apiUpdateCallScript } from '@/lib/api';

const SCRIPT_TYPES = [
  { key: 'prediction_lead', label: 'Prediction Lead Script' },
  { key: 'order', label: 'Order Script' },
];

const DEFAULT_LEAD_SCRIPT = `Hello [Customer Name], this is [Agent Name] from Vita Call.

I'm calling to discuss an opportunity that I believe could benefit you.

[Introduce Product/Service]

Would you be interested in learning more about [Product]?

[If interested] Great! Let me share some details with you...
[If not interested] I understand, thank you for your time.

Thank you for your time, [Customer Name]. Have a great day!`;

const DEFAULT_ORDER_SCRIPT = `Hello [Customer Name], this is [Agent Name] from Vita Call.

I'm calling regarding your order [Order ID].

[Verify order details with customer]

Your order includes [Product] and the total is [Price].

Can you please confirm your delivery address?
Address: [Address]
City: [City]

[If confirmed] Excellent! Your order will be processed shortly.
[If changes needed] Let me update that for you.

Thank you, [Customer Name]. Have a great day!`;

export default function CallScriptsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.isAdmin;
  const [activeTab, setActiveTab] = useState(SCRIPT_TYPES[0].key);
  const [scripts, setScripts] = useState<Record<string, { script_text: string; updated_at?: string; updated_by?: string }>>({});
  const [editedScripts, setEditedScripts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all(
      SCRIPT_TYPES.map(st =>
        apiGetCallScript(st.key).then(data => ({ key: st.key, data }))
      )
    )
      .then(results => {
        const map: Record<string, any> = {};
        const edited: Record<string, string> = {};
        for (const r of results) {
          map[r.key] = r.data || { script_text: '' };
          edited[r.key] = r.data?.script_text || '';
        }
        setScripts(map);
        setEditedScripts(edited);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (contextType: string) => {
    setSaving(true);
    try {
      const data = await apiUpdateCallScript(contextType, editedScripts[contextType] || '');
      setScripts(prev => ({ ...prev, [contextType]: data }));
      toast({ title: 'Script saved successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (contextType: string) => {
    setEditedScripts(prev => ({
      ...prev,
      [contextType]: scripts[contextType]?.script_text || '',
    }));
  };

  const handleLoadDefault = (contextType: string) => {
    const defaults: Record<string, string> = {
      prediction_lead: DEFAULT_LEAD_SCRIPT,
      order: DEFAULT_ORDER_SCRIPT,
    };
    setEditedScripts(prev => ({
      ...prev,
      [contextType]: defaults[contextType] || '',
    }));
  };

  const hasChanges = (contextType: string) =>
    editedScripts[contextType] !== (scripts[contextType]?.script_text || '');

  if (loading) {
    return (
      <AppLayout title="Call Scripts">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Call Scripts">
      <p className="mb-6 text-sm text-muted-foreground">
        {isAdmin
          ? 'Manage the call scripts that agents use during calls. Changes are reflected immediately.'
          : 'View the call scripts used during calls. Contact an admin to request changes.'}
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          {SCRIPT_TYPES.map(st => (
            <TabsTrigger key={st.key} value={st.key} className="gap-2">
              <FileText className="h-4 w-4" />
              {st.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SCRIPT_TYPES.map(st => (
          <TabsContent key={st.key} value={st.key}>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Script editor / viewer */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base font-semibold">{st.label}</CardTitle>
                    {scripts[st.key]?.updated_at && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Last updated: {new Date(scripts[st.key].updated_at!).toLocaleString()}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isAdmin ? (
                      <>
                        <Textarea
                          value={editedScripts[st.key] || ''}
                          onChange={(e) => setEditedScripts(prev => ({ ...prev, [st.key]: e.target.value }))}
                          className="min-h-[400px] font-mono text-sm leading-relaxed"
                          placeholder="Enter the call script here..."
                        />
                        <div className="mt-4 flex items-center gap-2">
                          <Button
                            onClick={() => handleSave(st.key)}
                            disabled={saving || !hasChanges(st.key)}
                            className="gap-2"
                          >
                            <Save className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save Script'}
                          </Button>
                          {hasChanges(st.key) && (
                            <Button variant="outline" onClick={() => handleReset(st.key)}>
                              Discard Changes
                            </Button>
                          )}
                          {!editedScripts[st.key]?.trim() && (
                            <Button variant="ghost" onClick={() => handleLoadDefault(st.key)}>
                              Load Default Template
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg bg-muted/50 p-5 text-sm whitespace-pre-wrap leading-relaxed font-mono min-h-[300px]">
                        {scripts[st.key]?.script_text || 'No script configured yet. Contact an admin to set one up.'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Help / variables reference */}
              <div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Template Variables</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      Use these placeholders in your script. They'll be replaced with actual values during calls.
                    </p>
                    <div className="space-y-2">
                      {[
                        { var: '[Customer Name]', desc: 'Customer\'s name' },
                        { var: '[Product]', desc: 'Product name' },
                        { var: '[Order ID]', desc: 'Order display ID' },
                        { var: '[Agent Name]', desc: 'Agent\'s name (manual)' },
                        { var: '[Price]', desc: 'Product price (manual)' },
                        { var: '[Address]', desc: 'Customer address (manual)' },
                        { var: '[City]', desc: 'Customer city (manual)' },
                      ].map(v => (
                        <div key={v.var} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2">
                          <code className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary whitespace-nowrap">{v.var}</code>
                          <span className="text-xs text-muted-foreground">{v.desc}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </AppLayout>
  );
}
