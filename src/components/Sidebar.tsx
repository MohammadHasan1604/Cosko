'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import CoskoLogo from '@/components/ui/CoskoLogo';
import Icon from '@/components/ui/AppIcon';
import { useApp } from '@/context/AppContext';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeRoute?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number;
  badgeVariant?: 'danger' | 'warning' | 'info';
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const badgeColorMap: Record<string, string> = {
  danger: 'bg-danger text-white',
  warning: 'bg-warning text-white',
  info: 'bg-info text-white',
};

export default function Sidebar({ collapsed, mobileOpen, onMobileClose, activeRoute }: SidebarProps) {
  const { selectedStore, setStoreSelectorOpen, setUserProfileOpen, currentUser, inventory, purchases, branding } = useApp();

  const lowStockCount = inventory.filter((i) => i.qtyOnHand <= i.reorderPt).length;
  const pendingPOCount = purchases.filter((p) => p.status === 'Sent' || p.status === 'Draft').length;

  // Strict RBAC Navigation Group Filtering
  const roleAllowedHrefs: Record<string, string[]> = {
    'Super Admin': [
      '/dashboard', '/sales', '/inventory-management', '/categories', '/purchases', '/customers',
      '/customers/existing', '/repairs', '/vendors', '/expenses', '/accounting', '/central-profit',
      '/reports', '/employees', '/stores', '/users', '/audit-logs', '/settings'
    ],
    'Store Manager': [
      '/dashboard', '/sales', '/inventory-management', '/categories', '/purchases', '/customers',
      '/customers/existing', '/repairs', '/vendors', '/expenses', '/accounting', '/central-profit',
      '/reports', '/employees'
    ],
    'Inventory Auditor': [
      '/dashboard', '/inventory-management', '/categories', '/purchases', '/vendors', '/reports'
    ],
    'POS Cashier': [
      '/sales', '/customers', '/repairs'
    ],
    'Sales Executive': [
      '/sales', '/customers', '/repairs'
    ],
  };

  const allowedHrefs = roleAllowedHrefs[currentUser.role] || ['/sales'];

  const rawNavGroups: NavGroup[] = [
    {
      id: 'group-overview',
      label: 'Overview',
      items: [
        { id: 'nav-dashboard', label: 'Dashboard', icon: 'HomeIcon', href: '/dashboard' },
      ],
    },
    {
      id: 'group-commerce',
      label: 'Commerce',
      items: [
        { id: 'nav-sales', label: 'Sales & POS', icon: 'ShoppingCartIcon', href: '/sales' },
        { id: 'nav-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management', badge: lowStockCount, badgeVariant: 'warning' },
        { id: 'nav-categories', label: 'Categories', icon: 'TagIcon', href: '/categories' },
        { id: 'nav-purchases', label: 'Purchases', icon: 'TruckIcon', href: '/purchases', badge: pendingPOCount, badgeVariant: 'info' },
        { id: 'nav-customers', label: 'Customers', icon: 'UsersIcon', href: '/customers' },
        { id: 'nav-repairs', label: 'Repairs & Service', icon: 'WrenchScrewdriverIcon', href: '/repairs' },
        { id: 'nav-vendors', label: 'Vendors', icon: 'BuildingStorefrontIcon', href: '/vendors' },
      ],
    },
    {
      id: 'group-finance',
      label: 'Finance',
      items: [
        { id: 'nav-expenses', label: 'Expenses', icon: 'BanknotesIcon', href: '/expenses' },
        { id: 'nav-accounting', label: 'Accounting', icon: 'CalculatorIcon', href: '/accounting' },
        { id: 'nav-central-profit', label: 'Central Profit', icon: 'ArrowTrendingUpIcon', href: '/central-profit' },
        { id: 'nav-reports', label: 'Reports', icon: 'ChartBarIcon', href: '/reports' },
      ],
    },
    {
      id: 'group-org',
      label: 'Organization',
      items: [
        { id: 'nav-employees', label: 'Employees', icon: 'UserGroupIcon', href: '/employees' },
        { id: 'nav-stores', label: 'Stores', icon: 'MapPinIcon', href: '/stores' },
        { id: 'nav-users', label: 'Users & Roles', icon: 'ShieldCheckIcon', href: '/users' },
      ],
    },
    {
      id: 'group-system',
      label: 'System',
      items: [
        { id: 'nav-audit', label: 'Audit Logs', icon: 'ClipboardDocumentListIcon', href: '/audit-logs' },
        { id: 'nav-settings', label: 'Settings', icon: 'Cog6ToothIcon', href: '/settings' },
      ],
    },
  ];

  const navGroups = rawNavGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => allowedHrefs.includes(item.href)),
    }))
    .filter((g) => g.items.length > 0);

  const sidebarClasses = [
    'fixed top-0 left-0 h-full z-50 flex flex-col bg-card border-r border-border shadow-sidebar sidebar-transition overflow-hidden',
    collapsed ? 'w-16' : 'w-60',
    'hidden lg:flex',
  ].join(' ');

  const mobileSidebarClasses = [
    'fixed top-0 left-0 h-full z-50 flex flex-col bg-card border-r border-border shadow-sidebar sidebar-transition overflow-hidden w-60',
    'lg:hidden',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
  ].join(' ');

  const renderNavItem = (item: NavItem) => {
    const isActive = activeRoute === item.href || (activeRoute === '/' && item.href === '/dashboard');
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onMobileClose}
        className={isActive ? 'nav-item-active' : 'nav-item'}
        title={collapsed ? item.label : undefined}
      >
        <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={18} className="flex-shrink-0" />
        {!collapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className={`text-2xs px-1.5 py-0.5 rounded-full font-semibold ${badgeColorMap[item.badgeVariant ?? 'info']}`}>
            {item.badge}
          </span>
        )}
        {collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warning" />
        )}
      </Link>
    );
  };

  const renderSidebarContent = (isCollapsed: boolean) => (
    <>
      {/* Logo */}
      <div className={`flex items-center justify-between gap-2.5 px-3.5 py-4 border-b border-border flex-shrink-0 ${isCollapsed ? 'justify-center' : ''}`}>
        <Link href="/dashboard" onClick={onMobileClose} className="flex items-center gap-2.5 min-w-0">
          <CoskoLogo size={28} showText={!isCollapsed} />
        </Link>
        {!isCollapsed && (
          <button
            onClick={onMobileClose}
            className="lg:hidden text-muted-foreground hover:text-foreground p-1 rounded-md"
            aria-label="Close sidebar"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        )}
      </div>

      {/* Store selector */}
      {!isCollapsed && (
        <div className="px-3 py-3 border-b border-border flex-shrink-0">
          <div
            onClick={() => setStoreSelectorOpen(true)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted cursor-pointer hover:bg-border transition-colors duration-150"
          >
            <div className="w-5 h-5 rounded-md gradient-primary flex-shrink-0 flex items-center justify-center text-white text-2xs font-bold">
              {selectedStore === 'All Stores' ? 'ALL' : selectedStore}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{branding.appName}</p>
              <p className="text-2xs text-muted-foreground">{selectedStore}</p>
            </div>
            <Icon name="ChevronUpDownIcon" size={14} className="text-muted-foreground flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-5">
        {navGroups.map((group) => (
          <div key={group.id}>
            {!isCollapsed && (
              <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className={`border-t border-border p-3 flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {isCollapsed ? (
          <div
            onClick={() => setUserProfileOpen(true)}
            className="w-8 h-8 rounded-full overflow-hidden cursor-pointer hover:opacity-90 flex-shrink-0"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                {currentUser.avatar}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => setUserProfileOpen(true)}
            className="flex items-center gap-2.5 px-1 cursor-pointer hover:bg-muted/60 p-1.5 rounded-xl transition-colors"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {currentUser.avatar}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{currentUser.name}</p>
              <p className="text-2xs text-muted-foreground">{currentUser.role}</p>
            </div>
            <Icon name="ArrowRightOnRectangleIcon" size={16} className="text-muted-foreground hover:text-danger transition-colors" />
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className={sidebarClasses}>
        {renderSidebarContent(collapsed)}
      </div>

      {/* Mobile sidebar */}
      <div className={mobileSidebarClasses}>
        {renderSidebarContent(false)}
      </div>
    </>
  );
}