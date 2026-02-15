import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { UserPlus, Shield, Headphones, ToggleLeft, ToggleRight, Loader2, Trash2 } from 'lucide-react';
import { apiGetUsers, apiCreateUser, apiToggleUserActive, apiSetUserRoles, apiDeleteUser } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AVAILABLE_ROLES = ['admin', 'agent'] as const;
const ROLE_ICONS: Record<string, any> = { admin: Shield, agent: Headphones };
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary',
  agent: 'bg-accent text-accent-foreground',
};

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  role: string; // legacy
  is_active: boolean;
  orders_processed: number;
  leads_processed: number;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoles, setFormRoles] = useState<Set<string>>(new Set(['agent']));
  const [formPassword, setFormPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = () => {
    setLoading(true);
    apiGetUsers()
      .then((data) => {
        // Normalize: ensure roles array exists
        setUsers(data.map((u: any) => ({
          ...u,
          roles: u.roles || [u.role || 'agent'],
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleFormRole = (role: string) => {
    setFormRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) {
        if (next.size > 1) next.delete(role); // must keep at least one
      } else {
        next.add(role);
      }
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
      await apiCreateUser({ full_name: formName, email: formEmail, role: Array.from(formRoles)[0], password: formPassword });
      // If multiple roles, set them after creation
      // The create endpoint now supports roles array via the body
      toast({ title: 'User created' });
      setShowModal(false);
      setFormName(''); setFormEmail(''); setFormPassword(''); setFormRoles(new Set(['agent']));
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateWithRoles = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    if (formRoles.size === 0) {
      toast({ title: 'Error', description: 'At least one role is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const headers = await getHeadersForCreate();
      const res = await fetch(`${getApiBase()}/users/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          full_name: formName,
          email: formEmail,
          password: formPassword,
          roles: Array.from(formRoles),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      toast({ title: 'User created' });
      setShowModal(false);
      setFormName(''); setFormEmail(''); setFormPassword(''); setFormRoles(new Set(['agent']));
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (userId: string) => {
    try {
      await apiToggleUserActive(userId);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleRole = async (userId: string, role: string, currentRoles: string[]) => {
    const hasRole = currentRoles.includes(role);
    let newRoles: string[];
    if (hasRole) {
      newRoles = currentRoles.filter(r => r !== role);
      if (newRoles.length === 0) {
        toast({ title: 'Error', description: 'User must have at least one role', variant: 'destructive' });
        return;
      }
    } else {
      newRoles = [...currentRoles, role];
    }
    try {
      await apiSetUserRoles(userId, newRoles);
      toast({ title: 'Roles updated' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDeleteUser(deleteTarget.user_id);
      toast({ title: 'User deleted' });
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <AppLayout title="Users">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} total users</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
            {users.map(u => (
              <tr key={u.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {u.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isSelf(u.user_id) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.map(r => {
                        const Icon = ROLE_ICONS[r] || Shield;
                        return (
                          <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[r] || 'bg-muted text-muted-foreground'}`}>
                            <Icon className="h-3 w-3" />
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_ROLES.map(role => {
                        const hasRole = u.roles.includes(role);
                        const Icon = ROLE_ICONS[role] || Shield;
                        return (
                          <button
                            key={role}
                            onClick={() => handleToggleRole(u.user_id, role, u.roles)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border ${
                              hasRole
                                ? `${ROLE_COLORS[role]} border-current`
                                : 'border-border text-muted-foreground hover:bg-muted'
                            }`}
                            title={hasRole ? `Remove ${role} role` : `Add ${role} role`}
                          >
                            <Icon className="h-3 w-3" />
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => !isSelf(u.user_id) && handleToggle(u.user_id)}
                    disabled={isSelf(u.user_id)}
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      isSelf(u.user_id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${u.is_active ? 'text-success' : 'text-destructive'}`}
                  >
                    {u.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {u.is_active ? 'Active' : 'Suspended'}
                  </button>
                </td>
                <td className="px-4 py-3 font-semibold">{u.orders_processed}</td>
                <td className="px-4 py-3 font-semibold">{u.leads_processed}</td>
                <td className="px-4 py-3">
                  {!isSelf(u.user_id) && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-card-foreground">Create New User</h2>
            <div className="mt-4 space-y-3">
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Full Name" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <input value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              
              {/* Multi-role selection */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Roles</label>
                <div className="flex gap-2">
                  {AVAILABLE_ROLES.map(role => {
                    const isSelected = formRoles.has(role);
                    const Icon = ROLE_ICONS[role] || Shield;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleFormRole(role)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <input value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Password" type="password" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateWithRoles} disabled={creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.full_name}</strong> ({deleteTarget?.email})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Helper functions for direct API calls in create
import { supabase } from '@/integrations/supabase/client';
function getApiBase() {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;
}
async function getHeadersForCreate() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
