import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  FileSpreadsheet,
  Package,
  Boxes,
  TruckIcon,
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
  PackageSearch,
  Settings,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ────── Nav config ──────

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
  /** Which roles can see this section (empty = all) */
  roles?: ('admin' | 'agent' | 'warehouse' | 'ads_admin')[];
}

const sections: NavSection[] = [
  {
    label: '',
    items: [{ title: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Sales',
    roles: ['admin', 'agent'],
    items: [
      { title: 'Orders', path: '/orders', icon: ShoppingCart },
      { title: 'Assigned to Me', path: '/assigned', icon: ClipboardList },
      { title: 'Prediction Leads', path: '/prediction-leads', icon: FileSpreadsheet },
      { title: 'Prediction Lists', path: '/predictions', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Warehouse',
    roles: ['admin', 'warehouse'],
    items: [
      { title: 'Warehouse', path: '/warehouse', icon: Warehouse },
    ],
  },
  {
    label: 'Team',
    roles: ['admin', 'agent'],
    items: [
      { title: 'Users', path: '/users', icon: Users },
      { title: 'Performance', path: '/performance', icon: BarChart3 },
      { title: 'Shifts Management', path: '/shifts', icon: CalendarDays },
      { title: 'My Shifts', path: '/my-shifts', icon: CalendarDays },
      { title: 'Call Scripts', path: '/call-scripts', icon: FileText },
      { title: 'Call History', path: '/call-history', icon: History },
    ],
  },
  {
    label: 'Products',
    roles: ['admin'],
    items: [
      { title: 'Products', path: '/products', icon: Package },
    ],
  },
  {
    label: 'Ads',
    roles: ['admin', 'ads_admin'],
    items: [
      { title: 'Ads Panel', path: '/ads', icon: BarChart3 },
    ],
  },
  {
    label: '',
    roles: ['admin'],
    items: [
      { title: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

// Filter items by role
function getVisibleSections(
  isAdmin: boolean,
  isAgent: boolean,
  isWarehouse: boolean,
  isAdsAdmin: boolean,
): NavSection[] {
  return sections
    .map((section) => {
      // If section has no role restriction, show always
      if (!section.roles) return section;

      // Check if user has any matching role
      const visible =
        (isAdmin && section.roles.includes('admin')) ||
        (isAgent && section.roles.includes('agent')) ||
        (isWarehouse && section.roles.includes('warehouse')) ||
        (isAdsAdmin && section.roles.includes('ads_admin'));
      if (!visible) return null;

      // Filter individual items by special rules
      let items = section.items;

      // "Users" & "Performance" only for admin
      if (!isAdmin) {
        items = items.filter(
          (i) => i.path !== '/users' && i.path !== '/performance' && i.path !== '/shifts',
        );
      }

      // "My Shifts" only for agents (or dual-role agents)
      if (!isAgent) {
        items = items.filter((i) => i.path !== '/my-shifts');
      }

      // "Assigned to Me" only for agents
      if (!isAgent) {
        items = items.filter((i) => i.path !== '/assigned');
      }

      if (items.length === 0) return null;
      return { ...section, items };
    })
    .filter(Boolean) as NavSection[];
}

// ────── Component ──────

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const isAgent = user?.isAgent ?? false;
  const isWarehouse = user?.isWarehouse ?? false;
  const isAdsAdmin = user?.isAdsAdmin ?? false;

  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const visibleSections = getVisibleSections(isAdmin, isAgent, isWarehouse, isAdsAdmin);

  // Initialize open sections (all open by default)
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    visibleSections.forEach((s) => {
      if (s.label) initial[s.label] = true;
    });
    setOpenSections(initial);
  }, [isAdmin, isAgent, isWarehouse, isAdsAdmin]);

  const toggleSection = (label: string) => {
    if (collapsed) return; // Don't toggle in collapsed mode
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
            {/* Section label */}
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

            {/* Collapsed section separator */}
            {section.label && collapsed && (
              <div className="mx-auto my-3 h-px w-6 bg-sidebar-border" />
            )}

            {/* Items */}
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
