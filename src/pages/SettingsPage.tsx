import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  apiGetUsers, apiCreateUser, apiToggleUserActive, apiSetUserRoles, apiDeleteUser,
  apiGetProducts, apiUpdateProduct,
} from '@/lib/api';
import {
  Users, Shield, Headphones, Package, Settings2, Palette, Warehouse,
  Search, UserPlus, ToggleLeft, ToggleRight, Trash2, Loader2,
  Sun, Moon, Eye, EyeOff, Bell, BellOff, ChevronDown, ChevronRight,
  AlertTriangle, Save, RotateCcw, Mail, Lock, User as UserIcon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

// ────── Constants ──────
const AVAILABLE_ROLES = ['admin', 'agent', 'warehouse'] as const;
const ROLE_ICONS: Record<string, any> = { admin: Shield, agent: Headphones, warehouse: Package };
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border-primary/30',
  agent: 'bg-info/10 text-info border-info/30',
  warehouse: 'bg-warning/10 text-warning border-warning/30',
};

const ORDER_STATUSES = [
  { key: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { key: 'take', label: 'Take', color: 'bg-blue-500' },
  { key: 'call_again', label: 'Call Again', color: 'bg-purple-500' },
  { key: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
  { key: 'shipped', label: 'Shipped', color: 'bg-cyan-500' },
  { key: 'returned', label: 'Returned', color: 'bg-red-500' },
  { key: 'paid', label: 'Paid', color: 'bg-emerald-500' },
  { key: 'trashed', label: 'Trashed', color: 'bg-gray-500' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-rose-500' },
];

const LEAD_STATUSES = [
  { key: 'not_contacted', label: 'Not Contacted', color: 'bg-gray-500' },
  { key: 'no_answer', label: 'No Answer', color: 'bg-yellow-500' },
  { key: 'interested', label: 'Interested', color: 'bg-blue-500' },
  { key: 'not_interested', label: 'Not Interested', color: 'bg-red-500' },
  { key: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
];

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_active: boolean;
  orders_processed: number;
  leads_processed: number;
  created_at: string;
}

// ────── Settings Page ──────
export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.isAdmin ?? false;

  if (!isAdmin) {
    return (
      <AppLayout title="Settings">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Shield className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">Admin access required</p>
          <p className="text-sm mt-1">You don't have permission to view settings.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="h-11 rounded-xl bg-muted/60 p-1 gap-1">
          <TabsTrigger value="users" className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" /> Users & Roles
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Settings2 className="h-4 w-4" /> System Rules
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Warehouse className="h-4 w-4" /> Warehouse
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-lg gap-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Palette className="h-4 w-4" /> Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="system"><SystemRulesTab /></TabsContent>
        <TabsContent value="warehouse"><WarehouseTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

// ════════════════════════════════════════════════════
// TAB 1: Users & Roles
// ════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoles, setFormRoles] = useState<Set<string>>(new Set(['agent']));
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = () => {
    setLoading(true);
    apiGetUsers()
      .then((data) => setUsers(data.map((u: any) => ({ ...u, roles: u.roles || [u.role || 'agent'] }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') result = result.filter(u => u.roles.includes(roleFilter));
    if (statusFilter !== 'all') result = result.filter(u => statusFilter === 'active' ? u.is_active : !u.is_active);
    return result;
  }, [users, search, roleFilter, statusFilter]);

  const toggleFormRole = (role: string) => {
    setFormRoles(prev => {
      const next = new Set(prev);
      next.has(role) && next.size > 1 ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ full_name: formName, email: formEmail, password: formPassword, roles: Array.from(formRoles) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: 'User created successfully' });
      setShowModal(false);
      setFormName(''); setFormEmail(''); setFormPassword(''); setFormRoles(new Set(['agent']));
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handleToggle = async (userId: string) => {
    try { await apiToggleUserActive(userId); fetchUsers(); } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleRole = async (userId: string, role: string, currentRoles: string[]) => {
    const hasRole = currentRoles.includes(role);
    const newRoles = hasRole ? currentRoles.filter(r => r !== role) : [...currentRoles, role];
    if (newRoles.length === 0) { toast({ title: 'Error', description: 'Must have at least one role', variant: 'destructive' }); return; }
    try { await apiSetUserRoles(userId, newRoles); toast({ title: 'Roles updated' }); fetchUsers(); } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await apiDeleteUser(deleteTarget.user_id); toast({ title: 'User deleted' }); setDeleteTarget(null); fetchUsers(); } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Users & Roles</h2>
          <p className="text-sm text-muted-foreground">{users.length} total users · {users.filter(u => u.is_active).length} active</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Roles</option>
          {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Roles</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Leads</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isSelf(u.user_id) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map(r => {
                          const Icon = ROLE_ICONS[r] || Shield;
                          return (
                            <span key={r} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[r]}`}>
                              <Icon className="h-3 w-3" /> {r.charAt(0).toUpperCase() + r.slice(1)}
                            </span>
                          );
                        })}
                        <Tooltip><TooltipTrigger><span className="text-xs text-muted-foreground ml-1">(you)</span></TooltipTrigger><TooltipContent>You can't change your own roles</TooltipContent></Tooltip>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_ROLES.map(role => {
                          const hasRole = u.roles.includes(role);
                          const Icon = ROLE_ICONS[role];
                          return (
                            <Tooltip key={role}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleToggleRole(u.user_id, role, u.roles)}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                                    hasRole ? ROLE_COLORS[role] : 'border-border text-muted-foreground/50 hover:bg-muted'
                                  }`}
                                >
                                  <Icon className="h-3 w-3" /> {role.charAt(0).toUpperCase() + role.slice(1)}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{hasRole ? `Remove ${role} role` : `Add ${role} role`}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => !isSelf(u.user_id) && handleToggle(u.user_id)}
                      disabled={isSelf(u.user_id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelf(u.user_id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
                      } ${u.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
                    >
                      {u.is_active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      {u.is_active ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{u.orders_processed}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{u.leads_processed}</td>
                  <td className="px-4 py-3">
                    {!isSelf(u.user_id) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => setDeleteTarget(u)} className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Delete user</TooltipContent>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Create New User</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe" className="w-full rounded-lg border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="john@example.com" type="email" className="w-full rounded-lg border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Roles</label>
                <div className="flex gap-2">
                  {AVAILABLE_ROLES.map(role => {
                    const isSelected = formRoles.has(role);
                    const Icon = ROLE_ICONS[role];
                    return (
                      <button key={role} type="button" onClick={() => toggleFormRole(role)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border ${
                          isSelected ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted'
                        }`}>
                        <Icon className="h-4 w-4" /> {role.charAt(0).toUpperCase() + role.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Minimum 6 characters" type="password" className="w-full rounded-lg border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ════════════════════════════════════════════════════
// TAB 2: System Rules
// ════════════════════════════════════════════════════
function SystemRulesTab() {
  const [autoAssign, setAutoAssign] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderHours, setReminderHours] = useState([24]);
  const [notifyOnStatusChange, setNotifyOnStatusChange] = useState(true);
  const [notifyOnNewOrder, setNotifyOnNewOrder] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>('statuses');

  const toggleSection = (s: string) => setExpandedSection(prev => prev === s ? null : s);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">System Rules</h2>
        <p className="text-sm text-muted-foreground">Configure order statuses, lead workflows, and automation rules.</p>
      </div>

      {/* Order Statuses */}
      <CollapsibleCard title="Order Statuses" subtitle={`${ORDER_STATUSES.length} statuses`} expanded={expandedSection === 'statuses'} onToggle={() => toggleSection('statuses')}>
        <div className="space-y-2">
          {ORDER_STATUSES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 hover:bg-muted/30 transition-colors">
              <div className={`h-3 w-3 rounded-full ${s.color}`} />
              <span className="text-sm font-medium flex-1">{s.label}</span>
              <Badge variant="outline" className="text-xs font-mono">{s.key}</Badge>
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* Lead Statuses */}
      <CollapsibleCard title="Lead Statuses" subtitle={`${LEAD_STATUSES.length} statuses`} expanded={expandedSection === 'leads'} onToggle={() => toggleSection('leads')}>
        <div className="space-y-2">
          {LEAD_STATUSES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 hover:bg-muted/30 transition-colors">
              <div className={`h-3 w-3 rounded-full ${s.color}`} />
              <span className="text-sm font-medium flex-1">{s.label}</span>
              <Badge variant="outline" className="text-xs font-mono">{s.key}</Badge>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* Automation */}
      <CollapsibleCard title="Automation" subtitle="Assignment & workflows" expanded={expandedSection === 'automation'} onToggle={() => toggleSection('automation')}>
        <div className="space-y-5">
          <SettingRow label="Auto-assign orders to agents" description="New orders are automatically distributed to available agents based on workload.">
            <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
          </SettingRow>
          <SettingRow label="Follow-up reminders" description={`Send a reminder if a lead hasn't been contacted within ${reminderHours[0]} hours.`}>
            <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
          </SettingRow>
          {reminderEnabled && (
            <div className="pl-4 border-l-2 border-primary/20">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Reminder delay (hours)</label>
              <Slider value={reminderHours} onValueChange={setReminderHours} min={1} max={72} step={1} className="w-48" />
              <p className="text-xs text-muted-foreground mt-1">{reminderHours[0]}h</p>
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* Notifications */}
      <CollapsibleCard title="Notifications" subtitle="Alerts & triggers" expanded={expandedSection === 'notifications'} onToggle={() => toggleSection('notifications')}>
        <div className="space-y-4">
          <SettingRow label="Notify on status change" description="Send notification when an order status is updated.">
            <Switch checked={notifyOnStatusChange} onCheckedChange={setNotifyOnStatusChange} />
          </SettingRow>
          <SettingRow label="Notify on new order" description="Alert agents when a new order is created or assigned.">
            <Switch checked={notifyOnNewOrder} onCheckedChange={setNotifyOnNewOrder} />
          </SettingRow>
        </div>
      </CollapsibleCard>
    </div>
  );
}

// ════════════════════════════════════════════════════
// TAB 3: Warehouse Configuration
// ════════════════════════════════════════════════════
function WarehouseTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    apiGetProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleThresholdChange = async (productId: string, value: number[]) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, low_stock_threshold: value[0] } : p));
    try {
      await apiUpdateProduct(productId, { low_stock_threshold: value[0] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Warehouse Configuration</h2>
        <p className="text-sm text-muted-foreground">Manage stock thresholds and alerts for products.</p>
      </div>

      {/* Global Settings */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Alert Settings</h3>
        <SettingRow label="Low stock alerts" description="Show visual alerts when product stock falls below the threshold.">
          <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
        </SettingRow>
      </div>

      {/* Products & Thresholds */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/50">
          <h3 className="text-sm font-semibold">Product Stock Thresholds</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <div className="divide-y">
            {products.map(p => {
              const stockPercent = p.low_stock_threshold > 0 ? (p.stock_quantity / (p.low_stock_threshold * 3)) * 100 : 100;
              const isLow = p.stock_quantity <= p.low_stock_threshold;
              return (
                <div key={p.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku || 'No SKU'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                        {p.stock_quantity} units
                        {isLow && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-destructive" />}
                      </p>
                      <p className="text-xs text-muted-foreground">Threshold: {p.low_stock_threshold}</p>
                    </div>
                  </div>
                  {/* Stock bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${isLow ? 'bg-destructive' : stockPercent < 50 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(stockPercent, 100)}%` }} />
                  </div>
                  {/* Threshold slider */}
                  <div className="flex items-center gap-4">
                    <label className="text-xs text-muted-foreground shrink-0">Low stock at:</label>
                    <Slider value={[p.low_stock_threshold]} onValueChange={(v) => handleThresholdChange(p.id, v)} min={1} max={500} step={5} className="flex-1" />
                    <span className="text-xs font-medium tabular-nums w-12 text-right">{p.low_stock_threshold}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// TAB 4: Appearance
// ════════════════════════════════════════════════════
function AppearanceTab() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [compactMode, setCompactMode] = useState(false);
  const [showOrderCards, setShowOrderCards] = useState(true);
  const [showLeadCards, setShowLeadCards] = useState(true);
  const [showWarehouseCards, setShowWarehouseCards] = useState(true);
  const [showTeamCards, setShowTeamCards] = useState(true);
  const [showActivityFeed, setShowActivityFeed] = useState(true);

  const toggleTheme = (dark: boolean) => {
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Load theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize your dashboard look and feel.</p>
      </div>

      {/* Theme */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Theme</h3>
        <div className="flex gap-3">
          <button
            onClick={() => toggleTheme(false)}
            className={`flex-1 flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all ${
              !isDark ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sun className="h-6 w-6 text-warning" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Light</p>
              <p className="text-xs text-muted-foreground">Clean & bright</p>
            </div>
          </button>
          <button
            onClick={() => toggleTheme(true)}
            className={`flex-1 flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all ${
              isDark ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Moon className="h-6 w-6 text-info" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Dark</p>
              <p className="text-xs text-muted-foreground">Easy on the eyes</p>
            </div>
          </button>
        </div>
      </div>

      {/* Dashboard Widgets */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Dashboard Widgets</h3>
        <p className="text-xs text-muted-foreground">Toggle which cards appear on the dashboard.</p>
        <div className="space-y-3">
          <SettingRow label="Order metrics" description="Total orders, confirmed, shipped stats">
            <Switch checked={showOrderCards} onCheckedChange={setShowOrderCards} />
          </SettingRow>
          <SettingRow label="Lead metrics" description="Lead counts and conversion rates">
            <Switch checked={showLeadCards} onCheckedChange={setShowLeadCards} />
          </SettingRow>
          <SettingRow label="Warehouse overview" description="Stock levels and low stock alerts">
            <Switch checked={showWarehouseCards} onCheckedChange={setShowWarehouseCards} />
          </SettingRow>
          <SettingRow label="Team performance" description="Agent leaderboard and stats">
            <Switch checked={showTeamCards} onCheckedChange={setShowTeamCards} />
          </SettingRow>
          <SettingRow label="Activity feed" description="Recent actions and status changes">
            <Switch checked={showActivityFeed} onCheckedChange={setShowActivityFeed} />
          </SettingRow>
        </div>
      </div>

      {/* Layout */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Layout</h3>
        <SettingRow label="Compact mode" description="Reduce padding and spacing throughout the app.">
          <Switch checked={compactMode} onCheckedChange={setCompactMode} />
        </SettingRow>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// Shared Components
// ════════════════════════════════════════════════════
function CollapsibleCard({ title, subtitle, expanded, onToggle, children }: {
  title: string; subtitle?: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
        <div>
          <h3 className="text-sm font-semibold text-left">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="border-t px-5 py-4">{children}</div>}
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
