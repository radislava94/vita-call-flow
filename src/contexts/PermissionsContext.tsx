import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/contexts/AuthContext';

// ── Types ──

export interface ModuleSetting {
  module_key: string;
  module_label: string;
  is_enabled: boolean;
  is_protected: boolean;
}

export interface RolePermission {
  role: string;
  module_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

export interface FinancialVisibility {
  role: string;
  show_profit: boolean;
  show_net_contribution: boolean;
  show_cost: boolean;
  show_returned_value: boolean;
  show_financial_insights: boolean;
}

interface PermissionsContextType {
  modules: ModuleSetting[];
  rolePermissions: RolePermission[];
  financialVisibility: FinancialVisibility[];
  loading: boolean;
  /** Check if a module is globally enabled */
  isModuleEnabled: (moduleKey: string) => boolean;
  /** Check if current user can view a module (enabled + role has can_view) */
  canAccessModule: (moduleKey: string) => boolean;
  /** Check specific action permission for current user on a module */
  canAction: (moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete' | 'export') => boolean;
  /** Check if current user can see a financial metric */
  canSeeFinancial: (metric: keyof Omit<FinancialVisibility, 'role'>) => boolean;
  /** Refresh all permissions from DB */
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// ── Module key → route path mapping ──
export const MODULE_ROUTE_MAP: Record<string, string> = {
  dashboard: '/',
  insights: '/insights',
  operations: '/operations',
  orders: '/orders',
  inbound_leads: '/inbound-leads',
  assigner: '/assigner',
  lead_distribution: '/lead-distribution',
  assigned: '/assigned',
  prediction_leads: '/prediction-leads',
  prediction_lists: '/predictions',
  search_prediction: '/search-prediction',
  warehouse: '/warehouse',
  users: '/users',
  performance: '/performance',
  shifts: '/shifts',
  my_shifts: '/my-shifts',
  call_scripts: '/call-scripts',
  call_history: '/call-history',
  products: '/products',
  webhooks: '/webhooks',
  ads: '/ads',
  settings: '/settings',
};

export const ROUTE_MODULE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_ROUTE_MAP).map(([k, v]) => [v, k])
);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleSetting[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [financialVisibility, setFinancialVisibility] = useState<FinancialVisibility[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [modRes, permRes, finRes] = await Promise.all([
        supabase.from('module_settings').select('module_key, module_label, is_enabled, is_protected'),
        supabase.from('role_permissions').select('role, module_key, can_view, can_create, can_edit, can_delete, can_export'),
        supabase.from('financial_visibility').select('role, show_profit, show_net_contribution, show_cost, show_returned_value, show_financial_insights'),
      ]);
      if (modRes.data) setModules(modRes.data as ModuleSetting[]);
      if (permRes.data) setRolePermissions(permRes.data as RolePermission[]);
      if (finRes.data) setFinancialVisibility(finRes.data as FinancialVisibility[]);
    } catch {
      // Silently fail — permissions will default to restrictive
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAll();
    else setLoading(false);
  }, [user?.id]);

  const isModuleEnabled = useCallback((moduleKey: string): boolean => {
    const mod = modules.find(m => m.module_key === moduleKey);
    return mod ? mod.is_enabled : true; // default enabled if not found
  }, [modules]);

  const userRoles: AppRole[] = user?.roles ?? [];

  const canAccessModule = useCallback((moduleKey: string): boolean => {
    if (!isModuleEnabled(moduleKey)) return false;
    // Admin always has access
    if (userRoles.includes('admin')) return true;
    // Check if any of user's roles have can_view for this module
    return userRoles.some(role => {
      const perm = rolePermissions.find(p => p.role === role && p.module_key === moduleKey);
      return perm?.can_view ?? false;
    });
  }, [isModuleEnabled, userRoles, rolePermissions]);

  const canAction = useCallback((moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete' | 'export'): boolean => {
    if (!isModuleEnabled(moduleKey)) return false;
    if (userRoles.includes('admin')) return true;
    return userRoles.some(role => {
      const perm = rolePermissions.find(p => p.role === role && p.module_key === moduleKey);
      if (!perm) return false;
      switch (action) {
        case 'view': return perm.can_view;
        case 'create': return perm.can_create;
        case 'edit': return perm.can_edit;
        case 'delete': return perm.can_delete;
        case 'export': return perm.can_export;
        default: return false;
      }
    });
  }, [isModuleEnabled, userRoles, rolePermissions]);

  const canSeeFinancial = useCallback((metric: keyof Omit<FinancialVisibility, 'role'>): boolean => {
    if (userRoles.includes('admin')) return true;
    return userRoles.some(role => {
      const vis = financialVisibility.find(v => v.role === role);
      return vis ? vis[metric] : false;
    });
  }, [userRoles, financialVisibility]);

  return (
    <PermissionsContext.Provider value={{
      modules, rolePermissions, financialVisibility, loading,
      isModuleEnabled, canAccessModule, canAction, canSeeFinancial,
      refresh: fetchAll,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
