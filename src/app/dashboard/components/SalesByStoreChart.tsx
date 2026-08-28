'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Mock data — backend integration: GET /api/v1/reports/sales-by-store
const data = [
  { store: 'BLR', sales: 1248600, budget: 1200000 },
  { store: 'HYD', sales: 874200, budget: 950000 },
  { store: 'DEL', sales: 718850, budget: 700000 },
];

const formatINR = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${(v / 1000).toFixed(0)}K`;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-modal px-4 py-3 text-sm">
      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={`bar-tooltip-${p.name}`} className="font-semibold text-foreground font-tabular">
          {formatINR(p.value)}
        </p>
      ))}
    </div>
  );
};

const barColors = ['var(--primary)', 'var(--accent)', 'var(--positive)'];

export default function SalesByStoreChart() {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={24}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="store" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatINR} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
        <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={`bar-cell-${idx}`} fill={barColors[idx % barColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}