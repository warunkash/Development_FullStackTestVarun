import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface DataPoint {
  date: string;
  gridEnergy: number;
  solarEnergy: number;
}

interface EnergyChartProps {
  data: DataPoint[];
  loading?: boolean;
}

export default function EnergyChart({ data, loading }: EnergyChartProps) {
  if (loading) return <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />;

  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'dd MMM'),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="solar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00A651" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#00A651" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v} kWh`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `${value.toLocaleString()} kWh`,
            name === 'solarEnergy' ? 'Solar' : 'Grid',
          ]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Legend formatter={(value) => (value === 'solarEnergy' ? 'Solar Energy' : 'Grid Energy')} />
        <Area type="monotone" dataKey="gridEnergy" stroke="#00A651" fill="url(#grid)" strokeWidth={2} />
        <Area type="monotone" dataKey="solarEnergy" stroke="#f59e0b" fill="url(#solar)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
