import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGetShifts, apiCreateShift, apiUpdateShift, apiDeleteShift, apiGetAgents } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface ShiftAgent { user_id: string; full_name: string; }
interface Shift {
  id: string; name: string; date: string; start_time: string; end_time: string;
  agents: ShiftAgent[]; created_at: string;
}

export default function ShiftsManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [calMonth, setCalMonth] = useState(new Date());

  // Form state
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDateEnd, setFormDateEnd] = useState('');
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('17:00');
  const [formAgents, setFormAgents] = useState<string[]>([]);

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', filterAgent, filterFrom, filterTo],
    queryFn: () => apiGetShifts({
      agent_id: filterAgent !== 'all' ? filterAgent : undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
    }),
  });

  const { data: agents = [] } = useQuery<{ user_id: string; full_name: string; email: string }[]>({
    queryKey: ['agents'],
    queryFn: apiGetAgents,
  });

  const createMutation = useMutation({
    mutationFn: apiCreateShift,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); closeDialog(); toast({ title: 'Shift created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiUpdateShift(id, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); closeDialog(); toast({ title: 'Shift updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: apiDeleteShift,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shifts'] }); toast({ title: 'Shift deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditingShift(null); resetForm(); };
  const resetForm = () => { setFormName(''); setFormDate(''); setFormDateEnd(''); setFormStart('09:00'); setFormEnd('17:00'); setFormAgents([]); };

  const openCreate = () => { resetForm(); setEditingShift(null); setDialogOpen(true); };
  const openEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormName(shift.name);
    setFormDate(shift.date);
    setFormDateEnd('');
    setFormStart(shift.start_time.substring(0, 5));
    setFormEnd(shift.end_time.substring(0, 5));
    setFormAgents(shift.agents.map(a => a.user_id));
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formDate || !formStart || !formEnd) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' }); return;
    }
    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, body: { name: formName.trim(), date: formDate, start_time: formStart, end_time: formEnd, agent_ids: formAgents } });
    } else {
      createMutation.mutate({ name: formName.trim(), date: formDate, date_end: formDateEnd || undefined, start_time: formStart, end_time: formEnd, agent_ids: formAgents });
    }
  };

  const toggleAgent = (id: string) => {
    setFormAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  // Calendar helpers
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
  const getShiftsForDay = (day: Date) => shifts.filter(s => isSameDay(new Date(s.date), day));

  if (!user?.isAdmin) return <AppLayout title="Access Denied"><div className="p-6">Access denied</div></AppLayout>;

  return (
    <AppLayout title="Shifts Management">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Shifts Management</h1>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create Shift</Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Agent</Label>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-40" />
          </div>
          {(filterFrom || filterTo || filterAgent !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterAgent('all'); setFilterFrom(''); setFilterTo(''); }}>Clear</Button>
          )}
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No shifts found</div>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Agents</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map(shift => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">{shift.name}</TableCell>
                        <TableCell>{format(new Date(shift.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {shift.agents.length === 0 ? <span className="text-muted-foreground text-xs">Unassigned</span> : shift.agents.map(a => (
                              <Badge key={a.user_id} variant="secondary" className="text-xs">{a.full_name}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(shift)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this shift?')) deleteMutation.mutate(shift.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <h3 className="text-lg font-semibold text-foreground">{format(calMonth, 'MMMM yyyy')}</h3>
                  <Button variant="ghost" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                  ))}
                  {calendarDays.map(day => {
                    const dayShifts = getShiftsForDay(day);
                    return (
                      <div key={day.toISOString()} className={`bg-card min-h-[80px] p-1 ${!isSameMonth(day, calMonth) ? 'opacity-40' : ''}`}>
                        <div className={`text-xs font-medium mb-1 ${isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-foreground'}`}>{format(day, 'd')}</div>
                        <div className="space-y-0.5">
                          {dayShifts.slice(0, 3).map(s => (
                            <div key={s.id} className="text-[10px] bg-primary/10 text-primary rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary/20" onClick={() => openEdit(s)} title={`${s.name} (${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)})`}>
                              {s.start_time.substring(0, 5)} {s.name}
                            </div>
                          ))}
                          {dayShifts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayShifts.length - 3} more</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); else setDialogOpen(true); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingShift ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Shift Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Morning Shift" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{editingShift ? 'Date *' : 'Start Date *'}</Label>
                  <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>
                {!editingShift && (
                  <div>
                    <Label>End Date (optional)</Label>
                    <Input type="date" value={formDateEnd} onChange={e => setFormDateEnd(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Time *</Label>
                  <Input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} />
                </div>
                <div>
                  <Label>End Time *</Label>
                  <Input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Assign Agents</Label>
                <div className="mt-1 border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                  {agents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No agents available</p>
                  ) : agents.map(a => (
                    <label key={a.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1">
                      <input type="checkbox" checked={formAgents.includes(a.user_id)} onChange={() => toggleAgent(a.user_id)} className="rounded" />
                      <span className="text-sm">{a.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingShift ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
