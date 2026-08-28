import React from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';

// Mock data — backend integration: GET /api/v1/audit-logs?limit=10&types=sale,purchase,transfer,adjustment
const activities = [
  { id: 'act-001', type: 'sale', icon: 'ShoppingCartIcon', color: 'text-primary', bg: 'bg-primary/10', title: 'Invoice #INV-2026-4821 raised', meta: 'Rajesh Kumar · ₹18,400 · Bengaluru', time: '4 min ago', badge: { variant: 'active' as const, label: 'Paid' } },
  { id: 'act-002', type: 'purchase', icon: 'TruckIcon', color: 'text-info', bg: 'bg-info/10', title: 'PO #PO-2026-0312 received', meta: 'Vendor: Havells India Ltd · 48 units · ₹72,600', time: '18 min ago', badge: { variant: 'active' as const, label: 'Completed' } },
  { id: 'act-003', type: 'alert', icon: 'ExclamationTriangleIcon', color: 'text-warning', bg: 'bg-warning/10', title: 'Low stock alert: Bosch 12V Drill', meta: 'SKU-1042 · Bengaluru · 2 units remaining', time: '31 min ago', badge: { variant: 'warning' as const, label: 'Low Stock' } },
  { id: 'act-004', type: 'transfer', icon: 'ArrowsRightLeftIcon', color: 'text-accent', bg: 'bg-accent/10', title: 'Stock transfer #TR-0089 approved', meta: 'BLR → HYD · Philips LED Bulbs · 50 units', time: '1h 12min ago', badge: { variant: 'info' as const, label: 'In Transit' } },
  { id: 'act-005', type: 'payment', icon: 'BanknotesIcon', color: 'text-positive', bg: 'bg-positive/10', title: 'Payment received from Priya Enterprises', meta: '₹45,000 · UPI · Invoice #INV-2026-4798', time: '2h 04min ago', badge: { variant: 'active' as const, label: 'Received' } },
  { id: 'act-006', type: 'adjustment', icon: 'AdjustmentsHorizontalIcon', color: 'text-muted-foreground', bg: 'bg-muted', title: 'Stock adjustment: Anchor 3-Pin Plug', meta: 'SKU-1198 · Delhi · -12 units · Damage', time: '3h 28min ago', badge: { variant: 'neutral' as const, label: 'Adjusted' } },
  { id: 'act-007', type: 'sale', icon: 'ShoppingCartIcon', color: 'text-primary', bg: 'bg-primary/10', title: 'Sales return #RET-2026-0214 processed', meta: 'Suresh Nair · ₹3,200 refund · Hyderabad', time: '4h 55min ago', badge: { variant: 'warning' as const, label: 'Returned' } },
  { id: 'act-008', type: 'purchase', icon: 'BuildingStorefrontIcon', color: 'text-info', bg: 'bg-info/10', title: 'New vendor bill: Polycab Wires #BILL-0441', meta: 'Due 27 Aug 2026 · ₹1,24,800 · Pending', time: '6h 10min ago', badge: { variant: 'pending' as const, label: 'Pending' } },
];

export default function RecentActivityFeed() {
  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="section-header">Recent Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">All stores · Live feed</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border">
        {activities.map((act) => (
          <div key={act.id} className="flex items-start gap-3.5 px-4 py-3.5 hover:bg-muted/50 transition-colors duration-100 cursor-pointer">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${act.bg}`}>
              <Icon name={act.icon as Parameters<typeof Icon>[0]['name']} size={15} className={act.color} />
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
        ))}
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