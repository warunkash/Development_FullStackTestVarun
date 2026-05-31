import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type ColorVariant = 'green' | 'blue' | 'yellow' | 'red' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color?: ColorVariant;
  loading?: boolean;
}

const colorMap: Record<ColorVariant, { bg: string; icon: string }> = {
  green: { bg: 'bg-green-50', icon: 'text-green-600' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600' },
  red: { bg: 'bg-red-50', icon: 'text-red-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
};

export default function StatCard({
  title,
  value,
  unit,
  change,
  changeLabel,
  icon,
  color = 'green',
  loading = false,
}: StatCardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-20" />
      </div>
    );
  }

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', colors.bg)}>
          <span className={colors.icon}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {change > 0 ? (
            <TrendingUp className="w-3 h-3 text-green-500" />
          ) : change < 0 ? (
            <TrendingDown className="w-3 h-3 text-red-500" />
          ) : (
            <Minus className="w-3 h-3 text-gray-400" />
          )}
          <span
            className={clsx(
              'text-xs font-medium',
              change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
            )}
          >
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
          {changeLabel && <span className="text-xs text-gray-400">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
