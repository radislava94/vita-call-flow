import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'manager' | 'pending_agent' | 'prediction_agent' | 'warehouse' | 'ads_admin' | 'agent';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
  isAdmin: boolean;
  isManager: boolean;
  isPendingAgent: boolean;
  isPredictionAgent: boolean;
  isWarehouse: boolean;
  isAdsAdmin: boolean;
  isAgent: boolean;
  /** Primary role for display purposes */
  role: AppRole;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function determinePrimaryRole(roles: AppRole[]): AppRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('prediction_agent')) return 'prediction_agent';
  if (roles.includes('pending_agent')) return 'pending_agent';
  if (roles.includes('agent')) return 'agent';
  if (roles.includes('warehouse')) return 'warehouse';
  if (roles.includes('ads_admin')) return 'ads_admin';
  return 'pending_agent';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (supabaseUser: User) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', supabaseUser.id)
        .single();

      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id);

      const roles: AppRole[] = (roleRows || []).map(r => r.role as AppRole);
      if (roles.length === 0) roles.push('pending_agent');

      setUser({
        id: supabaseUser.id,
        email: profile?.email || supabaseUser.email || '',
        full_name: profile?.full_name || supabaseUser.email || '',
        roles,
        isAdmin: roles.includes('admin'),
        isManager: roles.includes('manager'),
        isPendingAgent: roles.includes('pending_agent'),
        isPredictionAgent: roles.includes('prediction_agent'),
        isAgent: roles.includes('agent') || roles.includes('pending_agent') || roles.includes('prediction_agent'),
        isWarehouse: roles.includes('warehouse'),
        isAdsAdmin: roles.includes('ads_admin'),
        role: determinePrimaryRole(roles),
      });
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth loading timeout - forcing load complete');
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession?.user) {
          fetchProfile(newSession.user).finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
