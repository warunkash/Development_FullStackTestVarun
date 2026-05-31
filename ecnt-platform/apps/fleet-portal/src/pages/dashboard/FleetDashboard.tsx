import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Car, Zap, IndianRupee, TrendingUp, AlertCircle,
  Battery, Users, ArrowUpRight,
} from 'lucide-react';

// ─── Mock data ───────────────────────────────────────────────────────────────
const costTrend = Array.from({ length: 30 }, (_, i) => ({
  day: `May ${i + 1}`,
  cost: Math.round(3000 + Math.random() * 4000),
  kwh: Math.round(80 + Math.random() * 120),
}));

const vehicleStatusData = [
  { name: 'Available', value: 18, color: '#22c55e' },
  { name: 'Charging',  value: 7,  color: '#3b82f6' },
  { name: 'Offline',   value: 3,  color: '#9ca3af' },
];

const utilizationData = [
  { reg: 'TS09EA0001', model: 'Tata Ace EV', driver: 'Ravi Kumar',    kwh: 48.2, sessions: 4, cost: 1928 },
  { reg: 'TS09EA0002', model: 'MG ZS EV',   driver: 'Sunita Rao',    kwh: 62.1, sessions: 5, cost: 2484 },
  { reg: 'TS09EA0003', model: 'Nexon EV',   driver: 'Kiran Reddy',   kwh: 35.8, sessions: 3, cost: 1432 },
  { reg: 'TS09EA0004', model: 'Nexon EV',   driver: 'Priya Sharma',  kwh: 71.4, sessions: 6, cost: 2856 },
  { reg: 'TS09EA0005', model: 'Tata Ace EV',driver: 'Arjun Singh',   kwh: 29.5, sessions: 2, cost: 1180 },
];

const recentSessions = [
  { id: 'S10045', vehicle: 'TS09EA0002', driver: 'Sunita Rao',   station: 'Gachibowli DC-01', kwh: 22.4, amount: 896,  duration: '45 min', time: '10:30 AM' },
  { id: 'S10044', vehicle: 'TS09EA0001', driver: 'Ravi Kumar',   station: 'HITEC City AC-03', kwh: 18.7, amount: 748,  duration: '38 min', time: '9:15 AM' },
  { id: 'S10043', vehicle: 'TS09EA0004', driver: 'Priya Sharma', station: 'Madhapur Fast-02', kwh: 31.2, amount: 1248, duration: '55 min', time: '8:00 AM' },
];

const driverLeaderboard = [
  { name: 'Priya Sharma',  sessions: 6, kwh: 71.4, efficiency: 92 },
  { name: 'Sunita Rao',    sessions: 5, kwh: 62.1, efficiency: 88 },
  { name: 'Ravi Kumar',    sessions: 4, kwh: 48.2, efficiency: 85 },
  { name: 'Kiran Reddy',   sessions: 3, kwh: 35.8, efficiency: 80 },
  { name: 'Arjun Singh',   sessions: 2, kwh: 29.5, efficiency: 74 },
];

// ─── Sub-components ──────────────────────────────────────────────────────────
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div className="card flex items-start gap-4">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
type SortKey = 'kwh' | 'sessions' | 'cost';

export default function FleetDashboard() {
  const [sortKey, setSortKey] = useState<SortKey>('kwh');
  const sorted = [...utilizationData].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Fleet Overview</h2>
        <span className="text-sm text-gray-500">May 2026</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Car size={22} className="text-white" />}
          label="Fleet Size"
          value="28"
          sub="18 available · 7 charging · 3 offline"
          color="bg-green-600"
        />
        <StatCard
          icon={<IndianRupee size={22} className="text-white" />}
          label="This Month Spend"
          value="₹1,24,860"
          sub="+8% vs last month"
          color="bg-blue-600"
        />
        <StatCard
          icon={<Zap size={22} className="text-white" />}
          label="Total Energy"
          value="3,124 kWh"
          sub="245 sessions"
          color="bg-purple-600"
        />
        <StatCard
          icon={<AlertCircle size={22} className="text-white" />}
          label="Outstanding Balance"
          value="₹12,450"
          sub="Due Jun 5, 2026"
          color="bg-orange-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Trend */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Cost Trend (Last 30 Days)</h3>
            <TrendingUp size={16} className="text-green-600" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={costTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, 'Cost']} />
              <Line type="monotone" dataKey="cost" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle Status Pie */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Vehicle Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={vehicleStatusData} cx="50%" cy="45%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                {vehicleStatusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Utilization table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Vehicle Utilization</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Sort by:</span>
            {(['kwh', 'sessions', 'cost'] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  sortKey === k ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {k === 'kwh' ? 'Energy' : k === 'sessions' ? 'Sessions' : 'Cost'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-3 text-gray-500 font-medium">Reg. No.</th>
                <th className="text-left pb-3 text-gray-500 font-medium">Model</th>
                <th className="text-left pb-3 text-gray-500 font-medium">Driver</th>
                <th className="text-right pb-3 text-gray-500 font-medium">Energy (kWh)</th>
                <th className="text-right pb-3 text-gray-500 font-medium">Sessions</th>
                <th className="text-right pb-3 text-gray-500 font-medium">Cost (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((v) => (
                <tr key={v.reg} className="hover:bg-gray-50">
                  <td className="py-3 font-mono text-gray-900">{v.reg}</td>
                  <td className="py-3 text-gray-700">{v.model}</td>
                  <td className="py-3 text-gray-700">{v.driver}</td>
                  <td className="py-3 text-right font-medium text-blue-700">{v.kwh}</td>
                  <td className="py-3 text-right">{v.sessions}</td>
                  <td className="py-3 text-right font-medium text-green-700">₹{v.cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Sessions</h3>
            <a href="/sessions" className="text-xs text-green-600 hover:underline flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </a>
          </div>
          <div className="space-y-3">
            {recentSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.vehicle}</p>
                  <p className="text-xs text-gray-500">{s.station} · {s.time}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">₹{s.amount}</p>
                  <p className="text-xs text-gray-500">{s.kwh} kWh · {s.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Leaderboard */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-green-600" />
            <h3 className="font-semibold text-gray-900">Driver Leaderboard</h3>
          </div>
          <div className="space-y-3">
            {driverLeaderboard.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                    i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{d.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{d.sessions} sessions</span>
                    <span>·</span>
                    <span>{d.kwh} kWh</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-700">{d.efficiency}%</p>
                  <p className="text-xs text-gray-400">efficiency</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
