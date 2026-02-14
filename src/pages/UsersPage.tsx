import { useState, useEffect } from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { UserPlus, MoreHorizontal, Shield, Headphones, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { apiGetUsers, apiCreateUser, apiToggleUserActive } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface UserRow {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
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
  const [formRole, setFormRole] = useState('agent');
  const [formPassword, setFormPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchUsers = () => {
    setLoading(true);
    apiGetUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await apiCreateUser({ full_name: formName, email: formEmail, role: formRole, password: formPassword });
      toast({ title: 'User created' });
      setShowModal(false);
      setFormName(''); setFormEmail(''); setFormPassword(''); setFormRole('agent');
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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Orders</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Leads</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.user_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {user.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info'
                  }`}>
                    {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <Headphones className="h-3 w-3" />}
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(user.user_id)}
                    className={`inline-flex items-center gap-1 text-xs font-medium ${user.is_active ? 'text-success' : 'text-muted-foreground'}`}
                  >
                    {user.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {user.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 font-semibold">{user.orders_processed}</td>
                <td className="px-4 py-3 font-semibold">{user.leads_processed}</td>
                <td className="px-4 py-3">
                  <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
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
              <select value={formRole} onChange={e => setFormRole(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
              <input value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Password" type="password" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
