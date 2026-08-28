import React from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';

// Mock data — backend integration: GET /api/v1/inventory/alerts?type=low-stock&limit=6
const alerts = [
  { id: 'alert-item-001', sku: 'SKU-1042', name: 'Bosch 12V Drill', store: 'BLR', qty: 2, reorder: 10, severity: 'out-of-stock' as const },
  { id: 'alert-item-002', sku: 'SKU-0218', name: 'Philips LED 9W (Pack of 6)', store: 'HYD', qty: 5, reorder: 20, severity: 'low-stock' as const },
  { id: 'alert-item-003', sku: 'SKU-0834', name: 'Havells 6A Switch Board', store: 'BLR', qty: 0, reorder: 15, severity: 'out-of-stock' as const },
  { id: 'alert-item-004', sku: 'SKU-1198', name: 'Anchor Roma 3 Pin Plug', store: 'DEL', qty: 8, reorder: 25, severity: 'low-stock' as const },
  { id: 'alert-item-005', sku: 'SKU-0562', name: 'Polycab 1.5 Sq Wire 90m', store: 'HYD', qty: 3, reorder: 12, severity: 'low-stock' as const },
  { id: 'alert-item-006', sku: 'SKU-0091', name: 'Crompton Fan Regulator', store: 'DEL', qty: 0, reorder: 8, severity: 'out-of-stock' as const },
];

export default function LowStockAlerts() {
  const outOfStockCount = alerts.filter((a) => a.severity === 'out-of-stock').length;
  const lowStockCount = alerts.filter((a) => a.severity === 'low-stock').length;

  return (
    <div className="card h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="section-header">Stock Alerts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="text-danger font-semibold">{outOfStockCount} out of stock</span>
            {' · '}
            <span className="text-warning font-semibold">{lowStockCount} low stock</span>
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
          <Icon name="ExclamationTriangleIcon" size={16} className="text-danger" />
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin divide-y divide-border">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors duration-100">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.severity === 'out-of-stock' ? 'bg-danger' : 'bg-warning'}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{alert.name}</p>
              <p className="text-2xs text-muted-foreground mt-0.5">{alert.sku} · {alert.store}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <StatusBadge
                variant={alert.severity}
                label={alert.qty === 0 ? 'Out of Stock' : `${alert.qty} left`}
              />
              <p className="text-2xs text-muted-foreground mt-0.5">Reorder: {alert.reorder}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border">
        <Link
          href="/inventory-management"
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          View all inventory alerts
          <Icon name="ArrowRightIcon" size={12} />
        </Link>
      </div>
    </div>
  );
}