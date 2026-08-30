'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import { useApp } from '@/context/AppContext';

export default function RecentActivityFeed() {
  const { sales, purchases, stockTransfers, auditLogs, selectedStore } = useApp();

  const saleActivities = sales
    .filter((s) => selectedStore === 'All Stores' || s.store === selectedStore)
    .map((s) => ({
      id: `sale-${s.id}`,
      icon: 'ShoppingCartIcon' as const,
      color: 'text-primary',
      bg: 'bg-primary/10',
      title: `Invoice #${s.orderNo} raised`,
      meta: `${s.customerName || 'Customer'} · ₹${(s.total || 0).toLocaleString('en-IN')} · ${s.store}`,
      time: s.createdAt || 'Recent',
      badge: { variant: 'active' as const, label: s.paymentMethod || 'Paid' },
    }));

  const purchaseActivities = purchases
    .filter((p) => selectedStore === 'All Stores' || p.store === selectedStore)
    .map((p) => ({
      id: `po-${p.id}`,
      icon: 'TruckIcon' as const,
      color: 'text-info',
      bg: 'bg-info/10',
      title: `PO #${p.poNo} created`,
      meta: `Vendor: ${p.vendorName || 'Supplier'} · ₹${(p.totalAmount || 0).toLocaleString('en-IN')}`,
      time: p.createdAt || 'Recent',
      badge: { variant: p.status === 'Received' ? ('active' as const) : ('pending' as const), label: p.status },
    }));

  const transferActivities = stockTransfers
    .filter((t) => selectedStore === 'All Stores' || t.sourceStore === selectedStore || t.destStore === selectedStore)
    .map((t) => ({
      id: `transfer-${t.id}`,
      icon: 'ArrowsRightLeftIcon' as const,
      color: 'text-accent',
      bg: 'bg-accent/10',
      title: `Stock transfer #${t.transferNo}`,
      meta: `${t.sourceStore} → ${t.destStore} · ${t.productName} · ${t.qty} units`,
      time: t.createdAt || 'Recent',
      badge: { variant: 'info' as const, label: t.status },
    }));

  const auditActivities = auditLogs.map((a) => ({
    id: `audit-${a.id}`,
    icon: 'ShieldCheckIcon' as const,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    title: `${a.action}: ${a.module}`,
    meta: `${a.details} · by ${a.userName}`,
    time: a.timestamp || 'Recent',
    badge: { variant: 'neutral' as const, label: a.module },
  }));

  const activities = [...saleActivities, ...purchaseActivities, ...transferActivities, ...auditActivities].slice(0, 10);

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="section-header">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{selectedStore} · Live feed</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center h-48">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
              <Icon name="ClockIcon" size={20} className="text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground">No recent activity</p>
            <p className="text-2xs text-muted-foreground mt-1 max-w-[220px]">Live transactions, purchase orders, and stock movements will appear here automatically.</p>
          </div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="flex items-start gap-3.5 px-4 py-3.5 hover:bg-muted/50 transition-colors duration-100 cursor-pointer">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${act.bg}`}>
                <Icon name={act.icon} size={15} className={act.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground leading-snug">{act.title}</p>
                  <StatusBadge variant={act.badge.variant} label={act.badge.label} />
                </div>
                <p className="text-2xs text-muted-foreground mt-0.5 truncate">{act.meta}</p>
                <p className="text-2xs text-muted-foreground mt-1">{act.time}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border">
        <button className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-primary hover:underline">
          View full audit log
          <Icon name="ArrowRightIcon" size={12} />
        </button>
      </div>
    </div>
  );
}