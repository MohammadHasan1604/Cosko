'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '@/context/AppContext';

const COLORS = ['var(--primary)', 'var(--positive)', 'var(--accent)', 'var(--warning)', 'var(--muted-foreground)'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { amount: string } }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-card border border-border rounded-xl shadow-modal px-3 py-2.5 text-sm">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground text-xs">{item.value}% · {item.payload.amount}</p>
    </div>
  );
};

export default function PaymentMethodsChart() {
  const { sales, selectedStore } = useApp();

  const filteredSales = sales.filter((s) => selectedStore === 'All Stores' || s.store === selectedStore);

  const methodTotals: Record<string, number> = { UPI: 0, Cash: 0, Card: 0, Credit: 0 };
  let grandTotal = 0;

  filteredSales.forEach((s) => {
    const m = s.paymentMethod || 'Cash';
    methodTotals[m] = (methodTotals[m] || 0) + (s.total || 0);
    grandTotal += s.total || 0;
  });

  const data = Object.keys(methodTotals).map((method) => {
    const amountVal = methodTotals[method];
    const pct = grandTotal > 0 ? Math.round((amountVal / grandTotal) * 100) : 0;
    return {
      method,
      value: grandTotal > 0 ? pct : 25, // default equal slices if empty
      displayPct: pct,
      amount: `₹${amountVal.toLocaleString('en-IN')}`,
    };
  });
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={100} height={100}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={44}
            dataKey="value"
            nameKey="method"
            strokeWidth={0}
          >
            {data.map((_, idx) => (
              <Cell key={`pie-cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {data.map((item, idx) => (
          <div key={`legend-${item.method}`} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span className="text-xs text-muted-foreground flex-1">{item.method}</span>
            <span className="text-xs font-semibold text-foreground font-tabular">{item.displayPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}