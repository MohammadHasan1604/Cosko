'use client';
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
    <header
      className="flex-shrink-0 bg-card/95 backdrop-blur-lg border-b border-border/80 flex items-center justify-between gap-2 px-3 lg:px-5 w-full z-30"
      style={{ height: 'var(--topbar-height)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile: hamburger for sidebar (secondary nav) */}
        <button
          onClick={onMobileMenuOpen}
          className="btn-ghost lg:hidden w-8 h-8 p-0 flex items-center justify-center flex-shrink-0 rounded-lg"
          aria-label="Open navigation menu"
        >
          <Icon name="Bars3Icon" size={18} />
        </button>

        {/* Desktop: sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="btn-ghost hidden lg:flex w-8 h-8 p-0 items-center justify-center flex-shrink-0 rounded-lg"
          aria-label="Toggle sidebar"
        >
          <Icon name="Bars3Icon" size={16} />
        </button>

        {/* Mobile: brand + store scope */}
        <div className="flex lg:hidden items-center gap-1.5 min-w-0">
          <CoskoLogo size={18} showText={false} />
          <span className="text-sm font-bold text-foreground truncate max-w-[100px]">
            {branding.appName || 'COSKO'}
          </span>
          <span className="text-3xs bg-primary/8 text-primary px-1.5 py-0.5 rounded-md font-bold truncate max-w-[80px]">
            {currentUser.role !== 'Super Admin'
              ? (currentUser.store || 'Store')
              : selectedStore === 'All Stores' ? 'All' : selectedStore === 'CENTRAL' ? 'HQ' : selectedStore}
          </span>
        </div>

        {/* Desktop: breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
          <CoskoLogo size={20} showText />
          <Icon name="ChevronRightIcon" size={12} className="text-muted-foreground/50" />
          <span className="text-2xs bg-primary/8 text-primary border border-primary/15 px-2 py-0.5 rounded-md font-semibold">
            {currentUser.role !== 'Super Admin'
              ? `${currentUser.store || selectedStore} Store`
              : selectedStore === 'All Stores'
              ? 'All Stores (Consolidated)'
              : selectedStore === 'CENTRAL'
              ? 'Central Warehouse'
              : `${selectedStore} Store`}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Desktop Search */}
      <div className="relative hidden md:block">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border/80 bg-muted/30 hover:bg-muted text-xs text-muted-foreground hover:text-foreground hover:border-slate-300 transition-all w-56 xl:w-64 shadow-2xs group cursor-pointer"
        >
          <Icon name="MagnifyingGlassIcon" size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="flex-1 text-left truncate">Search products, orders...</span>
          <kbd className="text-3xs bg-card px-1.5 py-0.5 rounded border border-border font-mono shadow-2xs">⌘K</kbd>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {/* Mobile search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-ghost md:hidden w-8 h-8 p-0 flex items-center justify-center rounded-lg cursor-pointer"
          aria-label="Search"
        >
          <Icon name="MagnifyingGlassIcon" size={18} />
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotificationsOpen(true)}
          className="btn-ghost w-8 h-8 p-0 flex items-center justify-center rounded-lg relative cursor-pointer"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Icon name="BellIcon" size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger ring-2 ring-card" />
          )}
        </button>

        <div className="w-px h-5 bg-border/60 mx-1 hidden lg:block" />

        {/* User profile */}
        <button
          onClick={() => setUserProfileOpen(true)}
          className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors border border-transparent hover:border-border/40"
          aria-label="User profile"
        >
          <div className="relative">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {currentUser.avatar}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-card ${
                currentUser.shiftStatus === 'On Shift' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              title={currentUser.shiftStatus}
            />
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">{currentUser.name}</p>
            <p className="text-3xs text-muted-foreground leading-tight">{currentUser.role}</p>
          </div>
          <Icon name="ChevronDownIcon" size={12} className="text-muted-foreground hidden lg:block" />
        </button>
      </div>
    </header>
  );
}