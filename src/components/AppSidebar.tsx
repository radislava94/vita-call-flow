import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  FileSpreadsheet,
  Package,
  BarChart3,
  Users,
  CalendarDays,
  FileText,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Phone,
  Warehouse,
  Settings,
  Inbox,
  Webhook,
  UserPlus,
  SearchIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  /** Which roles can see this specific item (empty/undefined = inherit from section) */
  allowedRoles?: AppRole[];
}

interface NavSection {
  label: string;
  items: NavItem[];
  /** Which roles can see this section */
  allowedRoles?: AppRole[];
}

const sections: NavSection[] = [
  {
    label: '',
    allowedRoles: ['admin', 'manager'],
    items: [{ title: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Sales',
    allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'],
    items: [
      { title: 'Orders', path: '/orders', icon: ShoppingCart, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
      { title: 'Inbound Leads', path: '/inbound-leads', icon: Inbox, allowedRoles: ['admin', 'manager'] },
      { title: 'Assigner', path: '/assigner', icon: UserPlus, allowedRoles: ['admin', 'manager'] },
      { title: 'Assigned to Me', path: '/assigned', icon: ClipboardList, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
      { title: 'Prediction Leads', path: '/prediction-leads', icon: FileSpreadsheet, allowedRoles: ['admin', 'manager', 'prediction_agent'] },
      { title: 'Prediction Lists', path: '/predictions', icon: FileSpreadsheet, allowedRoles: ['admin', 'manager'] },
      { title: 'Search Prediction', path: '/search-prediction', icon: SearchIcon, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
    ],
  },
  {
    label: 'Warehouse',
    allowedRoles: ['admin', 'manager', 'warehouse'],
    items: [
      { title: 'Warehouse', path: '/warehouse', icon: Warehouse },
    ],
  },
  {
    label: 'Team',
    allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'],
    items: [
      { title: 'Users', path: '/users', icon: Users, allowedRoles: ['admin', 'manager'] },
      { title: 'Performance', path: '/performance', icon: BarChart3, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
      { title: 'Shifts Management', path: '/shifts', icon: CalendarDays, allowedRoles: ['admin', 'manager'] },
      { title: 'My Shifts', path: '/my-shifts', icon: CalendarDays, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
      { title: 'Call Scripts', path: '/call-scripts', icon: FileText, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
      { title: 'Call History', path: '/call-history', icon: History, allowedRoles: ['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent'] },
    ],
  },
  {
    label: 'Products',
    allowedRoles: ['admin', 'manager'],
    items: [
      { title: 'Products', path: '/products', icon: Package },
      { title: 'Webhooks', path: '/webhooks', icon: Webhook },
    ],
  },
  {
    label: 'Ads',
    allowedRoles: ['admin', 'ads_admin'],
    items: [
      { title: 'Ads Panel', path: '/ads', icon: BarChart3 },
    ],
  },
  {
    label: '',
    allowedRoles: ['admin'],
    items: [
      { title: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

function getVisibleSections(userRoles: AppRole[]): NavSection[] {
  return sections
    .map((section) => {
      if (!section.allowedRoles) return section;

      const sectionVisible = section.allowedRoles.some(r => userRoles.includes(r));
      if (!sectionVisible) return null;

      // Filter items by their individual allowedRoles
      const items = section.items.filter(item => {
        if (!item.allowedRoles) return true;
        return item.allowedRoles.some(r => userRoles.includes(r));
      });

      if (items.length === 0) return null;
      return { ...section, items };
    })
    .filter(Boolean) as NavSection[];
}

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const userRoles: AppRole[] = user?.roles ?? [];

  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const visibleSections = getVisibleSections(userRoles);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    visibleSections.forEach((s) => {
      if (s.label) initial[s.label] = true;
    });
    setOpenSections(initial);
  }, [user?.roles?.join(',')]);

  const toggleSection = (label: string) => {
    if (collapsed) return;
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      {/* ── Brand ── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/20">
          <Phone className="h-4 w-4 text-primary-foreground" />
        </div>
        <span
          className={cn(
            'text-[15px] font-bold tracking-tight text-sidebar-accent-foreground transition-opacity duration-200',
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
          )}
        >
          Vita Call
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1">
        {visibleSections.map((section, idx) => (
          <div key={section.label || idx}>
            {section.label && !collapsed && (
              <button
                onClick={() => toggleSection(section.label)}
                className="group flex w-full items-center justify-between rounded-lg px-3 py-2 mt-4 mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
                aria-expanded={openSections[section.label]}
                aria-label={`Toggle ${section.label} section`}
              >
                <span>{section.label}</span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    openSections[section.label] ? 'rotate-0' : '-rotate-90',
                  )}
                />
              </button>
            )}

            {section.label && collapsed && (
              <div className="mx-auto my-3 h-px w-6 bg-sidebar-border" />
            )}

            <div
              className={cn(
                'space-y-0.5 overflow-hidden transition-all duration-200 ease-in-out',
                section.label && !collapsed && !openSections[section.label]
                  ? 'max-h-0 opacity-0'
                  : 'max-h-[500px] opacity-100',
              )}
            >
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                const linkContent = (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground',
                      )}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {!collapsed && (
                      <span className="truncate">{item.title}</span>
                    )}
                    {isActive && !collapsed && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.path} delayDuration={0}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={item.path}>{linkContent}</div>;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle ── */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
