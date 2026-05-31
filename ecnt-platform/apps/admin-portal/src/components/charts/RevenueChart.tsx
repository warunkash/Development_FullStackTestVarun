import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface DataPoint {
  date: string;
  revenue: number;
  sessions?: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  loading?: boolean;
}

export default function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) return <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />;

  const formatted = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'dd MMM'),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            name === 'revenue' ? `₹${value.toLocaleString('en-IN')}` : value,
            name === 'revenue' ? 'Revenue' : 'Sessions',
          ]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Legend />
        <Line type="monotone" dataKey="revenue" stroke="#00A651" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        {formatted[0]?.sessions !== undefined && (
          <Line type="monotone" dataKey="sessions" stroke="#00d4ff" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
