'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '@/context/AppContext';

const formatINR = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
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

const barColors = ['var(--primary)', 'var(--accent)', 'var(--positive)', 'var(--warning)', 'var(--info)'];

export default function SalesByStoreChart() {
  const { sales, storesList } = useApp();

  const storeSalesMap: Record<string, number> = {};
  storesList.forEach((st) => {
    storeSalesMap[st.code] = 0;
  });

  sales.forEach((s) => {
    const code = s.store || 'BLR';
    storeSalesMap[code] = (storeSalesMap[code] || 0) + (s.total || 0);
  });

  const data = Object.keys(storeSalesMap).map((code) => ({
    store: code,
    sales: storeSalesMap[code],
  }));

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