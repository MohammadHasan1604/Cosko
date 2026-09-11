'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import GlobalSearchModal from './GlobalSearchModal';
import NotificationsDrawer from './NotificationsDrawer';
import StoreSelectorModal from './StoreSelectorModal';
import UserProfileModal from './UserProfileModal';
import ForcePasswordChangeModal from './ForcePasswordChangeModal';
import AppErrorBoundary from './AppErrorBoundary';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import CoskoLogo from '@/components/ui/CoskoLogo';
import { useApp } from '@/context/AppContext';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute?: string;
}

const superAdminOnly = ['Super Admin'];
const managerRoles = ['Super Admin', 'Store Manager'];
const auditorRoles = ['Super Admin', 'Store Manager', 'Inventory Auditor'];
const cashierRoles = ['Super Admin', 'Store Manager', 'POS Cashier', 'Sales Executive'];

const routePermissions: Record<string, string[]> = {
  '/dashboard': managerRoles,
  '/sales': cashierRoles,
  '/inventory-management': auditorRoles,
  '/categories': auditorRoles,
  '/purchases': auditorRoles,
  '/customers': cashierRoles,
  '/customers/existing': cashierRoles,
  '/customers/360': cashierRoles,
  '/repairs': cashierRoles,
  '/vendors': auditorRoles,
  '/expenses': managerRoles,
  '/accounting': managerRoles,
  '/central-profit': managerRoles,
  '/reports': auditorRoles,
  '/employees': managerRoles,
  '/stores': superAdminOnly,
  '/users': superAdminOnly,
  '/audit-logs': superAdminOnly,
  '/settings': superAdminOnly,
  '/settings/data-connections': superAdminOnly,
};

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { currentUser, authStatus, branding } = useApp();

  // Redirect to login if user session is UNAUTHENTICATED (DO NOT FALL BACK TO SUPER ADMIN)
  useEffect(() => {
    if (authStatus === 'UNAUTHENTICATED') {
      router.push('/sign-up-login');
    }
  }, [authStatus, router]);

  // Dynamic Browser Tab Document Title & Favicon Logo Icon Update
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (branding.appName) {
        document.title = `${branding.appName} — Multi-Store Retail & POS Management`;
      }

      const activeFavicon = branding.faviconUrl || branding.logoUrl || '/favicon.svg';
      if (activeFavicon) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = activeFavicon;
      }
    }
  }, [branding.appName, branding.logoUrl, branding.faviconUrl]);

  // 1. Auth Loading State: Render clean loading skeleton while verifying session
  if (authStatus === 'AUTH_LOADING') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <CoskoLogo size={36} showText />
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mt-2" />
          <p className="text-xs font-semibold text-muted-foreground">Verifying COSKO Authenticated Session...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Prevent rendering UI before redirect
  if (authStatus === 'UNAUTHENTICATED') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <CoskoLogo size={36} showText />
          <p className="text-xs font-semibold text-muted-foreground mt-2">Redirecting to Login...</p>
        </div>
      </div>
    );
  }

  // Route Permission Check: Verify current user role against allowed roles for this route
  const allowedRoles = activeRoute ? routePermissions[activeRoute] : undefined;
  const isAuthorized = !allowedRoles || (currentUser.role && allowedRoles.includes(currentUser.role));

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        activeRoute={activeRoute}
      />

      {/* Main content */}
      <div
        className={`flex flex-col flex-1 min-w-0 content-transition transition-all duration-300 ml-0 ${
          sidebarCollapsed ? 'lg:ml-[var(--sidebar-collapsed-width)]' : 'lg:ml-[var(--sidebar-width)]'
        }`}
      >
        {/* Topbar */}
        <Topbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-12">
          {isAuthorized ? (
            <AppErrorBoundary>
              {children}
            </AppErrorBoundary>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-6 card">
              <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-3">
                <Icon name="LockClosedIcon" size={24} />
              </div>
              <h2 className="text-lg font-bold text-foreground">Access Denied (403 Forbidden)</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Your role <strong className="text-foreground">({currentUser.role})</strong> does not have permission to access <code className="text-primary font-bold">{activeRoute}</code>.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <GlobalSearchModal />
      <NotificationsDrawer />
      <StoreSelectorModal />
      <UserProfileModal />
      <ForcePasswordChangeModal />
    </div>
  );
}