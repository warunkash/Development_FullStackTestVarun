import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'white' | 'gray';
  className?: string;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
const colorMap = {
  green: 'border-ecnt-green border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
};

export default function Spinner({ size = 'md', color = 'green', className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        'rounded-full border-2 animate-spin',
        sizeMap[size],
        colorMap[color],
        className
      )}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-48">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
