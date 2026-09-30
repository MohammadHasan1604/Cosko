'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import BottomSheet from '@/components/ui/BottomSheet';
import { useApp } from '@/context/AppContext';
import { getMobileMoreNav, isRouteAllowed } from '@/lib/rbacEngine';

export default function BottomNav() {
  const pathname = usePathname();
  const { currentUser } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  // 5-Position Nav Layout: Sales is ALWAYS the exact center (Position 3)
  const leftSlots = useMemo(() => {
    const rawSlots = [
      { id: 'bnav-dashboard', label: 'Home', icon: 'HomeIcon', href: '/dashboard' },
      { id: 'bnav-inventory', label: 'Inventory', icon: 'CubeIcon', href: '/inventory-management' },
    ];
    return rawSlots.filter((slot) => isRouteAllowed(slot.href, currentUser));
  }, [currentUser]);

  const salesSlot = {
    id: 'bnav-sales',
    label: 'SALES',
    icon: 'ShoppingCartIcon',
    href: '/sales',
  };

  const rightSlotCustomer = {
    id: 'bnav-customers',
    label: 'Customers',
    icon: 'UsersIcon',
    href: '/customers',
  };

  const isSalesAllowed = isRouteAllowed('/sales', currentUser);
  const isCustomerAllowed = isRouteAllowed('/customers', currentUser);

  // Authoritative secondary items for More BottomSheet from single source of truth
  const secondaryNav = useMemo(() => {
    return getMobileMoreNav(currentUser);
  }, [currentUser]);

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
          {leftSlots[0] ? (
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
          ) : (
            <div className="flex-1" />
          )}

          {/* Position 2 (Left 2) */}
          {leftSlots[1] ? (
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
          ) : (
            <div className="flex-1" />
          )}

          {/* Position 3 (EXACT CENTER) — SALES CONTROL */}
          {/* Visibly larger, strongest visual priority, accessible min 44px touch target, clear active state */}
          {isSalesAllowed ? (
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
          ) : (
            <div className="flex-1" />
          )}

          {/* Position 4 (Right 1) — Customers */}
          {isCustomerAllowed ? (
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
          ) : (
            <div className="flex-1" />
          )}

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
