'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import BottomSheet from '@/components/ui/BottomSheet';
import { useApp } from '@/context/AppContext';
import { getAllowedRoutes } from '@/lib/rbacEngine';

interface NavDestination {
  id: string;
  label: string;
  icon: string;
  href: string;
}

// All secondary nav items with icons for the "More" bottom sheet
const allSecondaryNav: NavDestination[] = [
  { id: 'more-dashboard', label: 'Dashboard', icon: 'HomeIcon', href: '/dashboard' },
  { id: 'more-attendance', label: 'Shift Attendance', icon: 'ClockIcon', href: '/attendance' },
  { id: 'more-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
  { id: 'more-categories', label: 'Categories', icon: 'TagIcon', href: '/categories' },
  {
    id: 'more-stock-transfers',
    label: 'Stock Transfers',
    icon: 'ArrowsRightLeftIcon',
    href: '/stock-transfers',
  },
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
  { id: 'more-employees', label: 'Staff Roster', icon: 'UserGroupIcon', href: '/employees' },
  { id: 'more-stores', label: 'Stores', icon: 'MapPinIcon', href: '/stores' },
  { id: 'more-users', label: 'Users & Roles', icon: 'ShieldCheckIcon', href: '/users' },
  {
    id: 'more-work-activity',
    label: 'Work Activity',
    icon: 'ChartBarIcon',
    href: '/work-activity',
  },
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

  const allowedHrefs = getAllowedRoutes(currentUser.role);

  // 5-Position Nav Layout: Sales is ALWAYS the exact center (Position 3)
  const leftSlots: NavDestination[] = useMemo(() => {
    return [
      { id: 'bnav-dashboard', label: 'Home', icon: 'HomeIcon', href: '/dashboard' },
      { id: 'bnav-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
    ];
  }, []);

  const salesSlot: NavDestination = {
    id: 'bnav-sales',
    label: 'SALES',
    icon: 'ShoppingCartIcon',
    href: '/sales',
  };

  const rightSlotCustomer: NavDestination = {
    id: 'bnav-customers',
    label: 'Customers',
    icon: 'UsersIcon',
    href: '/customers',
  };

  const primaryHrefs = useMemo(() => {
    return new Set([...leftSlots.map((s) => s.href), salesSlot.href, rightSlotCustomer.href]);
  }, [leftSlots]);

  // Secondary items for the More BottomSheet: authorized for role but not in the 4 primary slots
  const secondaryNav = useMemo(() => {
    return allSecondaryNav.filter(
      (item) => allowedHrefs.includes(item.href) && !primaryHrefs.has(item.href)
    );
  }, [allowedHrefs, primaryHrefs]);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    return pathname?.startsWith(href) ?? false;
  };

  const isSalesActive = pathname?.startsWith('/sales') ?? false;
  const isMoreActive = secondaryNav.some((item) => isActive(item.href));

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border/80 lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        style={{ height: 'calc(var(--bottomnav-height, 56px) + env(safe-area-inset-bottom, 0px))' }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-between h-14 max-w-lg mx-auto px-2 relative">
          {/* Position 1 (Left 1) */}
          <Link
            href={leftSlots[0].href}
            className="flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 text-center transition-colors"
            data-active={isActive(leftSlots[0].href)}
            aria-current={isActive(leftSlots[0].href) ? 'page' : undefined}
            aria-label={leftSlots[0].label}
          >
            <Icon
              name={leftSlots[0].icon as Parameters<typeof Icon>[0]['name']}
              size={20}
              className={isActive(leftSlots[0].href) ? 'text-primary' : 'text-muted-foreground'}
            />
            <span
              className={`text-4xs mt-0.5 font-semibold leading-none ${
                isActive(leftSlots[0].href) ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              {leftSlots[0].label}
            </span>
          </Link>

          {/* Position 2 (Left 2) */}
          <Link
            href={leftSlots[1].href}
            className="flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 text-center transition-colors"
            data-active={isActive(leftSlots[1].href)}
            aria-current={isActive(leftSlots[1].href) ? 'page' : undefined}
            aria-label={leftSlots[1].label}
          >
            <Icon
              name={leftSlots[1].icon as Parameters<typeof Icon>[0]['name']}
              size={20}
              className={isActive(leftSlots[1].href) ? 'text-primary' : 'text-muted-foreground'}
            />
            <span
              className={`text-4xs mt-0.5 font-semibold leading-none ${
                isActive(leftSlots[1].href) ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              {leftSlots[1].label}
            </span>
          </Link>

          {/* Position 3 (EXACT CENTER) — SALES CONTROL */}
          {/* Visibly larger, strongest visual priority, accessible min 44px touch target, clear active state */}
          <div className="flex-1 flex flex-col items-center justify-center relative -top-3.5 px-1">
            <Link
              href="/sales"
              className={`group flex flex-col items-center justify-center transition-transform active:scale-95 min-h-[48px] min-w-[48px] ${
                isSalesActive ? 'scale-105' : ''
              }`}
              aria-current={isSalesActive ? 'page' : undefined}
              aria-label="Sales and POS Terminal"
            >
              <div
                className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-md ${
                  isSalesActive
                    ? 'bg-gradient-to-tr from-primary to-primary/85 text-primary-foreground ring-4 ring-primary/25 shadow-primary/35 shadow-lg'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-background shadow-primary/20'
                }`}
              >
                <Icon name="ShoppingCartIcon" size={24} className="text-white" />
              </div>
              <span
                className={`text-4xs font-black tracking-wider uppercase mt-1 leading-none ${
                  isSalesActive ? 'text-primary font-extrabold' : 'text-foreground'
                }`}
              >
                SALES
              </span>
            </Link>
          </div>

          {/* Position 4 (Right 1) — Customers */}
          <Link
            href={rightSlotCustomer.href}
            className="flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 text-center transition-colors"
            data-active={isActive(rightSlotCustomer.href)}
            aria-current={isActive(rightSlotCustomer.href) ? 'page' : undefined}
            aria-label={rightSlotCustomer.label}
          >
            <Icon
              name={rightSlotCustomer.icon as Parameters<typeof Icon>[0]['name']}
              size={20}
              className={
                isActive(rightSlotCustomer.href) ? 'text-primary' : 'text-muted-foreground'
              }
            />
            <span
              className={`text-4xs mt-0.5 font-semibold leading-none ${
                isActive(rightSlotCustomer.href)
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground'
              }`}
            >
              {rightSlotCustomer.label}
            </span>
          </Link>

          {/* Position 5 (Right 2) — More Sheet */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 text-center cursor-pointer transition-colors"
            data-active={isMoreActive}
            aria-label="More navigation modules"
          >
            <Icon
              name="EllipsisHorizontalIcon"
              size={20}
              className={isMoreActive ? 'text-primary' : 'text-muted-foreground'}
            />
            <span
              className={`text-4xs mt-0.5 font-semibold leading-none ${
                isMoreActive ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More Modules Bottom Sheet */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="All Modules & Features"
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 py-2 max-h-[60vh] overflow-y-auto">
          {secondaryNav.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl cursor-pointer transition-all min-h-[44px] ${
                isActive(item.href)
                  ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground active:scale-98'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive(item.href) ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted'
                }`}
              >
                <Icon
                  name={item.icon as Parameters<typeof Icon>[0]['name']}
                  size={20}
                  className={isActive(item.href) ? 'text-white' : 'text-foreground'}
                />
              </div>
              <span className="text-3xs font-semibold text-center leading-tight line-clamp-2">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
