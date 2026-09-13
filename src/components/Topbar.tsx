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
    <header className="flex-shrink-0 h-[58px] bg-card/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-6 w-full z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile menu */}
        <button
          onClick={onMobileMenuOpen}
          className="btn-ghost lg:hidden w-8 h-8 p-0 flex items-center justify-center flex-shrink-0 rounded-lg"
          aria-label="Open navigation menu"
        >
          <Icon name="Bars3Icon" size={18} />
        </button>

        {/* Sidebar toggle (desktop) */}
        <button
          onClick={onToggleSidebar}
          className="btn-ghost hidden lg:flex w-8 h-8 p-0 items-center justify-center flex-shrink-0 rounded-lg"
          aria-label="Toggle sidebar"
        >
          <Icon name="Bars3Icon" size={16} />
        </button>

        {/* Store Scope Badge on Mobile */}
        <div className="flex lg:hidden items-center gap-1.5 min-w-0">
          <CoskoLogo size={20} showText />
          <span className="text-3xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold truncate max-w-[120px]">
            {selectedStore === 'All Stores' ? 'Consolidated' : selectedStore === 'CENTRAL' ? 'Central' : selectedStore}
          </span>
        </div>

        {/* Breadcrumb / Page context (desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
          <CoskoLogo size={20} showText />
          <Icon name="ChevronRightIcon" size={12} className="text-muted-foreground/60" />
          <span className="font-medium text-2xs uppercase tracking-wider text-muted-foreground">Scope</span>
          <span className="text-2xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-semibold shadow-2xs">
            {selectedStore === 'All Stores'
              ? 'All Stores (Consolidated View)'
              : selectedStore === 'CENTRAL'
              ? 'COSKO Central Warehouse (CENTRAL)'
              : `${selectedStore} Store Hub`}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Search Trigger */}
      <div className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2.5 h-8.5 px-3 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-xs text-muted-foreground hover:text-foreground hover:border-slate-300 transition-all duration-150 w-64 shadow-2xs group cursor-pointer"
        >
          <Icon name="MagnifyingGlassIcon" size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="flex-1 text-left">Search products, orders...</span>
          <kbd className="text-3xs bg-card px-1.5 py-0.5 rounded border border-border font-mono shadow-2xs">⌘K</kbd>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setNotificationsOpen(true)}
          className="btn-ghost w-8.5 h-8.5 p-0 flex items-center justify-center rounded-lg relative cursor-pointer"
          aria-label="Notifications"
        >
          <Icon name="BellIcon" size={17} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger ring-2 ring-card animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="btn-ghost md:hidden w-8.5 h-8.5 p-0 flex items-center justify-center rounded-lg cursor-pointer"
          aria-label="Search"
        >
          <Icon name="MagnifyingGlassIcon" size={17} />
        </button>

        <div className="w-px h-5 bg-border/80 mx-1" />

        <div
          onClick={() => setUserProfileOpen(true)}
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/70 cursor-pointer transition-colors duration-150 border border-transparent hover:border-border/60"
        >
          <div className="relative">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0 shadow-2xs" />
            ) : (
              <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-2xs">
                {currentUser.avatar}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                currentUser.shiftStatus === 'On Shift' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={currentUser.shiftStatus}
            />
          </div>
          <div className="hidden lg:block text-left">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground leading-tight">{currentUser.name}</p>
              <span className={`px-1.5 py-0.2 text-3xs font-bold rounded-full ${
                currentUser.shiftStatus === 'On Shift' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {currentUser.shiftStatus === 'On Shift' ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-3xs text-muted-foreground leading-tight mt-0.5">{currentUser.role}</p>
          </div>
          <Icon name="ChevronDownIcon" size={13} className="text-muted-foreground hidden lg:block" />
        </div>
      </div>
    </header>
  );
}