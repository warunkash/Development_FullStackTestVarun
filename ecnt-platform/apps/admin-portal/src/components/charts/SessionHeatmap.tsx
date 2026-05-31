interface SessionHeatmapProps {
  data: number[][];
  loading?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  return `${h}${i < 12 ? 'a' : 'p'}`;
});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#f3f4f6';
  const pct = value / max;
  if (pct < 0.2) return '#d1fae5';
  if (pct < 0.4) return '#86efac';
  if (pct < 0.6) return '#4ade80';
  if (pct < 0.8) return '#22c55e';
  return '#00A651';
}

export default function SessionHeatmap({ data, loading }: SessionHeatmapProps) {
  if (loading) return <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />;

  const max = Math.max(...data.flat(), 0);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="flex gap-1 mb-1">
          <div className="w-8" />
          {HOURS.map((h, i) => (
            <div key={i} className="w-5 text-xs text-gray-400 text-center" style={{ fontSize: 9 }}>
              {h}
            </div>
          ))}
        </div>
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="w-8 text-xs text-gray-500 font-medium">{day}</div>
            {(data[di] ?? Array(24).fill(0)).map((val, hi) => (
              <div
                key={hi}
                className="w-5 h-5 rounded-sm cursor-default"
                style={{ backgroundColor: getColor(val, max) }}
                title={`${day} ${HOURS[hi]}: ${val} sessions`}
              />
            ))}
          </div>
        ))}
        <div className="flex items-center gap-1 mt-3">
          <span className="text-xs text-gray-400 mr-1">Low</span>
          {['#f3f4f6', '#d1fae5', '#86efac', '#4ade80', '#22c55e', '#00A651'].map((c) => (
            <div key={c} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span className="text-xs text-gray-400 ml-1">High</span>
        </div>
      </div>
    </div>
  );
}
