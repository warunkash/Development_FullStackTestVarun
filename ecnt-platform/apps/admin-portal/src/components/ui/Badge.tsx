import { clsx } from 'clsx';

type BadgeVariant =
  | 'active' | 'inactive' | 'faulted' | 'maintenance'
  | 'available' | 'charging' | 'reserved'
  | 'completed' | 'pending' | 'failed' | 'refunded'
  | 'open' | 'in_progress' | 'closed'
  | 'low' | 'medium' | 'high' | 'critical';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  active: 'bg-green-100 text-green-800',
  available: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  closed: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-700',
  low: 'bg-gray-100 text-gray-700',
  reserved: 'bg-blue-100 text-blue-800',
  charging: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  medium: 'bg-yellow-100 text-yellow-800',
  faulted: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
  critical: 'bg-red-100 text-red-800',
  refunded: 'bg-purple-100 text-purple-800',
  open: 'bg-orange-100 text-orange-800',
  high: 'bg-orange-100 text-orange-800',
};

const defaultLabels: Record<BadgeVariant, string> = {
  active: 'Active', inactive: 'Inactive', faulted: 'Faulted', maintenance: 'Maintenance',
  available: 'Available', charging: 'Charging', reserved: 'Reserved',
  completed: 'Completed', pending: 'Pending', failed: 'Failed', refunded: 'Refunded',
  open: 'Open', in_progress: 'In Progress', closed: 'Closed',
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
};

export default function Badge({ variant, label, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full',
        variantStyles[variant],
        className
      )}
    >
      {label ?? defaultLabels[variant]}
    </span>
  );
}
