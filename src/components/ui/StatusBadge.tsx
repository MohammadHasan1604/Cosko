import React from 'react';

type BadgeVariant = 'active' | 'inactive' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending' | 'draft' | 'completed' | 'low-stock' | 'out-of-stock';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  active: 'badge-active',
  completed: 'badge-active',
  inactive: 'badge-neutral',
  neutral: 'badge-neutral',
  draft: 'badge-neutral',
  warning: 'badge-warning',
  pending: 'badge-warning',
  danger: 'badge-danger',
  'out-of-stock': 'badge-danger',
  info: 'badge-info',
  'low-stock': 'badge-warning',
};

const dotColorMap: Record<BadgeVariant, string> = {
  active: 'bg-positive',
  completed: 'bg-positive',
  inactive: 'bg-muted-foreground',
  neutral: 'bg-muted-foreground',
  draft: 'bg-muted-foreground',
  warning: 'bg-warning',
  pending: 'bg-warning',
  danger: 'bg-danger',
  'out-of-stock': 'bg-danger',
  info: 'bg-info',
  'low-stock': 'bg-warning',
};

export default function StatusBadge({ variant, label, dot = false, className = '' }: StatusBadgeProps) {
  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColorMap[variant]}`} />
      )}
      {label}
    </span>
  );
}