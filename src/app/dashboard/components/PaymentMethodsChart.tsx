'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data — backend integration: GET /api/v1/reports/payment-methods-summary
const data = [
  { method: 'UPI', value: 38, amount: '₹10.8L' },
  { method: 'Cash', value: 28, amount: '₹7.96L' },
  { method: 'Card', value: 21, amount: '₹5.97L' },
  { method: 'Credit', value: 9, amount: '₹2.56L' },
  { method: 'Bank', value: 4, amount: '₹1.14L' },
];

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
            <span className="text-xs font-semibold text-foreground font-tabular">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}