import React from 'react';

export type BadgeVariant =
  | 'active'
  | 'inactive'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'draft'
  | 'completed'
  | 'low-stock'
  | 'out-of-stock'
  | 'success'
  | string;

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  active: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/80 dark:border-emerald-800/40', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/80 dark:border-emerald-800/40', dot: 'bg-emerald-500' },
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/80 dark:border-emerald-800/40', dot: 'bg-emerald-500' },
  paid: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/80 dark:border-emerald-800/40', dot: 'bg-emerald-500' },
  received: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200/80 dark:border-emerald-800/40', dot: 'bg-emerald-500' },

  warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/80 dark:border-amber-800/40', dot: 'bg-amber-500' },
  pending: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/80 dark:border-amber-800/40', dot: 'bg-amber-500' },
  partial: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/80 dark:border-amber-800/40', dot: 'bg-amber-500' },
  'low-stock': { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200/80 dark:border-amber-800/40', dot: 'bg-amber-500' },

  danger: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200/80 dark:border-rose-800/40', dot: 'bg-rose-500' },
  unpaid: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200/80 dark:border-rose-800/40', dot: 'bg-rose-500' },
  cancelled: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200/80 dark:border-rose-800/40', dot: 'bg-rose-500' },
  'out-of-stock': { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200/80 dark:border-rose-800/40', dot: 'bg-rose-500' },

  info: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200/80 dark:border-sky-800/40', dot: 'bg-sky-500' },
  ordered: { bg: 'bg-sky-50 dark:bg-sky-950/30', text: 'text-sky-700 dark:text-sky-400', border: 'border-sky-200/80 dark:border-sky-800/40', dot: 'bg-sky-500' },
  draft: { bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' },

  neutral: { bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' },
  inactive: { bg: 'bg-slate-100 dark:bg-slate-800/40', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-400' },
};

export default function StatusBadge({
  variant,
  label,
  dot = true,
  className = '',
  size = 'md',
}: StatusBadgeProps) {
  const key = String(variant).toLowerCase();
  const cfg = variantStyles[key] || variantStyles.neutral;

  const sizeClass = size === 'sm' ? 'px-2 py-0.2 text-3xs font-semibold' : 'px-2.5 py-0.5 text-2xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClass} tracking-wide transition-colors ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
      <span className="truncate">{label}</span>
    </span>
  );
}