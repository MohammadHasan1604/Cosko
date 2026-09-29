'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import BottomSheet from '@/components/ui/BottomSheet';
import { useApp } from '@/context/AppContext';

interface NavDestination {
  id: string;
  label: string;
  icon: string;
  href: string;
}

const roleAllowedHrefs: Record<string, string[]> = {
  'Super Admin': [
    '/dashboard',
    '/sales',
    '/inventory-management',
    '/stock-transfers',
    '/categories',
    '/purchases',
    '/customers',
    '/vendors',
    '/expenses',
    '/accounting',
    '/central-profit',
    '/reports',
    '/employees',
    '/stores',
    '/users',
    '/work-activity',
    '/audit-logs',
    '/settings',
    '/delete-requests',
  ],
  'Store Manager': [
    '/dashboard',
    '/sales',
    '/inventory-management',
    '/categories',
    '/purchases',
    '/customers',
    '/vendors',
    '/expenses',
    '/accounting',
    '/reports',
    '/employees',
  ],
  'Sales Manager': ['/sales', '/inventory-management', '/customers'],
};

// Primary bottom nav destinations per role (max ~4 + More)
const rolePrimaryNav: Record<string, NavDestination[]> = {
  'Super Admin': [
    { id: 'bnav-dashboard', label: 'Home', icon: 'HomeIcon', href: '/dashboard' },
    { id: 'bnav-sales', label: 'Sales', icon: 'ShoppingCartIcon', href: '/sales' },
    { id: 'bnav-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
    { id: 'bnav-reports', label: 'Reports', icon: 'ChartBarIcon', href: '/reports' },
  ],
  'Store Manager': [
    { id: 'bnav-dashboard', label: 'Home', icon: 'HomeIcon', href: '/dashboard' },
    { id: 'bnav-sales', label: 'Sales', icon: 'ShoppingCartIcon', href: '/sales' },
    { id: 'bnav-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
    { id: 'bnav-reports', label: 'Reports', icon: 'ChartBarIcon', href: '/reports' },
  ],
  'Sales Manager': [
    { id: 'bnav-sales', label: 'Sales', icon: 'ShoppingCartIcon', href: '/sales' },
    { id: 'bnav-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
    { id: 'bnav-customers', label: 'Customers', icon: 'UsersIcon', href: '/customers' },
  ],
};

// All secondary nav items with icons
const allSecondaryNav: NavDestination[] = [
  { id: 'more-dashboard', label: 'Dashboard', icon: 'HomeIcon', href: '/dashboard' },
  { id: 'more-sales', label: 'Sales & POS', icon: 'ShoppingCartIcon', href: '/sales' },
  { id: 'more-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
  {
    id: 'more-stock-transfers',
    label: 'Stock Transfers',
    icon: 'ArrowsRightLeftIcon',
    href: '/stock-transfers',
  },
  { id: 'more-categories', label: 'Categories', icon: 'TagIcon', href: '/categories' },
  { id: 'more-purchases', label: 'Purchases', icon: 'TruckIcon', href: '/purchases' },
  { id: 'more-customers', label: 'Customers', icon: 'UsersIcon', href: '/customers' },
  { id: 'more-vendors', label: 'Vendors', icon: 'BuildingStorefrontIcon', href: '/vendors' },
  { id: 'more-expenses', label: 'Expenses', icon: 'BanknotesIcon', href: '/expenses' },
  { id: 'more-accounting', label: 'Accounting', icon: 'CalculatorIcon', href: '/accounting' },
  {
    id: 'more-central-profit',
    label: 'Central Profit',
    icon: 'ArrowTrendingUpIcon',
    href: '/central-profit',
  },
  { id: 'more-reports', label: 'Reports', icon: 'ChartBarIcon', href: '/reports' },
  { id: 'more-employees', label: 'Employees', icon: 'UserGroupIcon', href: '/employees' },
  { id: 'more-stores', label: 'Stores', icon: 'MapPinIcon', href: '/stores' },
  { id: 'more-users', label: 'Users & Roles', icon: 'ShieldCheckIcon', href: '/users' },
  { id: 'more-work-activity', label: 'Work Activity', icon: 'ClockIcon', href: '/work-activity' },
  {
    id: 'more-delete-requests',
    label: 'Delete Requests',
    icon: 'TrashIcon',
    href: '/delete-requests',
  },
  {
    id: 'more-audit-logs',
    label: 'Audit Logs',
    icon: 'ClipboardDocumentListIcon',
    href: '/audit-logs',
  },
  { id: 'more-settings', label: 'Settings', icon: 'Cog6ToothIcon', href: '/settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { currentUser } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  const allowedHrefs = roleAllowedHrefs[currentUser.role] || ['/dashboard'];
  const primaryNav = rolePrimaryNav[currentUser.role] || rolePrimaryNav['Restricted Employee'];
  const primaryHrefs = new Set(primaryNav.map((n) => n.href));

  // Secondary items: authorized but not in primary nav
  const secondaryNav = useMemo(() => {
    return allSecondaryNav.filter(
      (item) => allowedHrefs.includes(item.href) && !primaryHrefs.has(item.href)
    );
  }, [allowedHrefs, primaryHrefs]);

  const hasMore = secondaryNav.length > 0;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    return pathname?.startsWith(href) ?? false;
  };

  const isMoreActive = secondaryNav.some((item) => isActive(item.href));

  return (
    <>
      <nav className="bottomnav lg:hidden" aria-label="Primary navigation">
        <div className="flex items-stretch h-full max-w-lg mx-auto">
          {primaryNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="bottomnav-item"
              data-active={isActive(item.href)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon
                name={item.icon as Parameters<typeof Icon>[0]['name']}
                size={20}
                className={isActive(item.href) ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className="bottomnav-label">{item.label}</span>
            </Link>
          ))}

          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className="bottomnav-item"
              data-active={isMoreActive}
              aria-label="More navigation options"
            >
              <Icon
                name="EllipsisHorizontalIcon"
                size={20}
                className={isMoreActive ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className="bottomnav-label">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More Bottom Sheet */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="All Modules">
        <div className="grid grid-cols-3 gap-1 py-1">
          {secondaryNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-colors ${
                isActive(item.href)
                  ? 'bg-primary/8 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isActive(item.href) ? 'bg-primary/10' : 'bg-muted'
                }`}
              >
                <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={20} />
              </div>
              <span className="text-2xs font-medium text-center leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
