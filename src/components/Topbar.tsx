'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import CoskoLogo from '@/components/ui/CoskoLogo';
import { useApp } from '@/context/AppContext';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onMobileMenuOpen: () => void;
}

export default function Topbar({ onToggleSidebar, onMobileMenuOpen }: TopbarProps) {
  const { setSearchOpen, setNotificationsOpen, setUserProfileOpen, notifications, currentUser, selectedStore, branding } = useApp();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="flex-shrink-0 h-[60px] bg-card border-b border-border flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 w-full">
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile menu */}
        <button
          onClick={onMobileMenuOpen}
          className="btn-ghost lg:hidden p-2 flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Icon name="Bars3Icon" size={20} />
        </button>

        {/* Sidebar toggle (desktop) */}
        <button
          onClick={onToggleSidebar}
          className="btn-ghost hidden lg:flex p-2 flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Icon name="Bars3Icon" size={18} />
        </button>

        {/* Store Scope Badge on Mobile */}
        <div className="flex lg:hidden items-center gap-1.5 min-w-0">
          <CoskoLogo size={20} showText />
          <span className="text-2xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold truncate max-w-[90px]">
            {selectedStore}
          </span>
        </div>

        {/* Breadcrumb / Page context (desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
          <CoskoLogo size={22} showText />
          <Icon name="ChevronRightIcon" size={14} />
          <span className="text-xs font-medium">Multi-Store Scope</span>
          <span className="text-2xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {selectedStore}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Search Trigger */}
      <div className="relative hidden md:block">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground hover:border-ring transition-all duration-150 w-64"
        >
          <Icon name="MagnifyingGlassIcon" size={15} />
          <span className="flex-1 text-left">Search products, orders...</span>
          <kbd className="text-2xs bg-card px-1.5 py-0.5 rounded border border-border font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setNotificationsOpen(true)}
          className="btn-ghost p-2 relative"
          aria-label="Notifications"
        >
          <Icon name="BellIcon" size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="btn-ghost p-2"
          aria-label="Search"
        >
          <Icon name="MagnifyingGlassIcon" size={18} />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <div
          onClick={() => setUserProfileOpen(true)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer transition-colors duration-150"
        >
          {currentUser.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {currentUser.avatar}
            </div>
          )}
          <div className="hidden lg:block">
            <p className="text-xs font-semibold text-foreground leading-tight">{currentUser.name}</p>
            <p className="text-2xs text-muted-foreground leading-tight">{currentUser.role}</p>
          </div>
          <Icon name="ChevronDownIcon" size={14} className="text-muted-foreground hidden lg:block" />
        </div>
      </div>
    </header>
  );
}