import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrderStatus } from '@/types';
import { AppLayout } from '@/layouts/AppLayout';
import { apiGetUnassignedPending, apiGetAssignedOrders, apiBulkAssignOrders, apiBulkUnassignOrders, apiGetOnlineAgents } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, UserPlus, UserMinus, Users, Inbox, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UnassignedOrder {
  id: string;
  display_id: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  source_type: string;
  created_at: string;
}

interface AssignedOrder {
  id: string;
  display_id: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  status: OrderStatus;
  assigned_agent_name: string | null;
  assigned_at: string | null;
  source_type: string;
  quantity: number;
  price: number;
}

interface OnlineAgent {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  active_leads: number;
  shift: { start_time: string; end_time: string } | null;
  is_online: boolean;
}

export default function AssignerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedAssigned, setSelectedAssigned] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');

  const { data: orders = [], isLoading: ordersLoading } = useQuery<UnassignedOrder[]>({
    queryKey: ['unassigned-pending'],
    queryFn: apiGetUnassignedPending,
    refetchInterval: 10000,
  });

  const { data: assignedOrders = [], isLoading: assignedLoading } = useQuery<AssignedOrder[]>({
    queryKey: ['assigned-orders'],
    queryFn: apiGetAssignedOrders,
    refetchInterval: 10000,
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery<OnlineAgent[]>({
    queryKey: ['online-agents'],
    queryFn: apiGetOnlineAgents,
    refetchInterval: 15000,
  });

  const assignMutation = useMutation({
    mutationFn: () => apiBulkAssignOrders(selectedOrders, selectedAgent),
    onSuccess: (data: any) => {
      toast({ title: `${data.assigned} order(s) assigned` });
      setSelectedOrders([]);
      setSelectedAgent('');
      queryClient.invalidateQueries({ queryKey: ['unassigned-pending'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['online-agents'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const unassignMutation = useMutation({
    mutationFn: () => apiBulkUnassignOrders(selectedAssigned),
    onSuccess: (data: any) => {
      toast({ title: `${data.unassigned} order(s) unassigned` });
      setSelectedAssigned([]);
      queryClient.invalidateQueries({ queryKey: ['unassigned-pending'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['online-agents'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const toggleOrder = (id: string) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const toggleAssigned = (id: string) => {
    setSelectedAssigned(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllAssigned = () => {
    if (selectedAssigned.length === assignedOrders.length) {
      setSelectedAssigned([]);
    } else {
      setSelectedAssigned(assignedOrders.map(o => o.id));
    }
  };

  const onlineAgents = agents.filter(a => a.is_online);

  return (
    <AppLayout title="Assigner">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left: Tabs ── */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--warning))]">
                  <Inbox className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unassigned</p>
                  <p className="text-xl font-bold">{orders.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                  <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned</p>
                  <p className="text-xl font-bold">{assignedOrders.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--success))]">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Online Agents</p>
                  <p className="text-xl font-bold">{onlineAgents.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="unassigned">
            <TabsList className="mb-3">
              <TabsTrigger value="unassigned">Unassigned ({orders.length})</TabsTrigger>
              <TabsTrigger value="assigned">Assigned Orders ({assignedOrders.length})</TabsTrigger>
            </TabsList>

            {/* ── Tab: Unassigned ── */}
            <TabsContent value="unassigned" className="space-y-4 mt-0">
              {/* Assignment controls */}
              <div className="flex items-center gap-3 rounded-xl border bg-card/80 backdrop-blur-sm p-3 shadow-sm">
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="w-56 h-9 text-sm rounded-lg">
                    <SelectValue placeholder="Select Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineAgents.map(a => (
                      <SelectItem key={a.user_id} value={a.user_id}>
                        <span className="flex items-center gap-2">
                          {a.full_name}
                          <Badge variant="outline" className="text-[10px] ml-1">{a.active_leads} active</Badge>
                        </span>
                      </SelectItem>
                    ))}
                    {onlineAgents.length === 0 && (
                      <SelectItem value="__none" disabled>No agents online</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg"
                  disabled={selectedOrders.length === 0 || !selectedAgent || assignMutation.isPending}
                  onClick={() => assignMutation.mutate()}
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Assign ({selectedOrders.length})
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">{orders.length} pending</span>
              </div>

              {/* Unassigned Table */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-4 py-3 w-10">
                          <Checkbox
                            checked={orders.length > 0 && selectedOrders.length === orders.length}
                            onCheckedChange={toggleAll}
                          />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr
                          key={order.id}
                          className={cn(
                            'border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer',
                            selectedOrders.includes(order.id) && 'bg-primary/5'
                          )}
                          onClick={() => toggleOrder(order.id)}
                        >
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={() => toggleOrder(order.id)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">{order.customer_name || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs">{order.customer_phone}</td>
                          <td className="px-4 py-3">
                            {order.product_name ? (
                              <Badge variant="outline" className="text-xs">{order.product_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px]">
                              {order.source_type === 'inbound_lead' ? 'Webhook' : order.source_type === 'prediction_lead' ? 'Lead' : 'Manual'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {format(new Date(order.created_at), 'MMM d, HH:mm')}
                          </td>
                        </tr>
                      ))}
                      {orders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                            No unassigned pending orders. All caught up! 🎉
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Assigned Orders ── */}
            <TabsContent value="assigned" className="space-y-4 mt-0">
              {/* Unassign controls */}
              <div className="flex items-center gap-3 rounded-xl border bg-card/80 backdrop-blur-sm p-3 shadow-sm">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9 gap-1.5 rounded-lg"
                  disabled={selectedAssigned.length === 0 || unassignMutation.isPending}
                  onClick={() => unassignMutation.mutate()}
                >
                  {unassignMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                  Unassign ({selectedAssigned.length})
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">{assignedOrders.length} assigned orders</span>
              </div>

              {/* Assigned Table */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {assignedLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-4 py-3 w-10">
                          <Checkbox
                            checked={assignedOrders.length > 0 && selectedAssigned.length === assignedOrders.length}
                            onCheckedChange={toggleAllAssigned}
                          />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total Price</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedOrders.map(order => (
                        <tr
                          key={order.id}
                          className={cn(
                            'border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer',
                            selectedAssigned.includes(order.id) && 'bg-primary/5'
                          )}
                          onClick={() => toggleAssigned(order.id)}
                        >
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedAssigned.includes(order.id)}
                              onCheckedChange={() => toggleAssigned(order.id)}
                            />
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                          <td className="px-4 py-3 font-medium">{order.customer_name || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs">{order.customer_phone}</td>
                          <td className="px-4 py-3">
                            {order.product_name ? (
                              <Badge variant="outline" className="text-xs">{order.product_name}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-primary">
                            {((order.quantity || 1) * Number(order.price)).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">{order.assigned_agent_name || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {order.assigned_at ? format(new Date(order.assigned_at), 'MMM d, HH:mm') : '—'}
                          </td>
                        </tr>
                      ))}
                      {assignedOrders.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                            No assigned orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Right: Online Agents Panel ── */}
        <div className="space-y-4">
          <Card className="border-none shadow-sm sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Online Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agentsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : onlineAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No agents online</p>
              ) : (
                onlineAgents.map(agent => (
                  <div
                    key={agent.user_id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl p-3 transition-colors cursor-pointer',
                      selectedAgent === agent.user_id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/30 hover:bg-muted/50'
                    )}
                    onClick={() => setSelectedAgent(agent.user_id)}
                  >
                    <div className="relative">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {agent.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-[hsl(var(--success))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.full_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{agent.active_leads} active</span>
                        {agent.shift && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {agent.shift.start_time?.slice(0, 5)} - {agent.shift.end_time?.slice(0, 5)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {agent.roles.map(r => (
                        <Badge key={r} variant="outline" className="text-[9px] capitalize">{r}</Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
