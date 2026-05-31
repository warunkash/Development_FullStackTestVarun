import React, { useState } from 'react';
import { Download, Filter, Zap, IndianRupee, Clock, TrendingUp } from 'lucide-react';

interface Session {
  id: string;
  vehicle: string;
  driver: string;
  station: string;
  startTime: string;
  duration: string;
  kwh: number;
  amount: number;
  status: 'completed' | 'in-progress' | 'failed';
}

const sessions: Session[] = [
  { id: 'S10045', vehicle: 'TS09EA0002', driver: 'Sunita Rao',   station: 'Gachibowli DC-01',  startTime: '2026-05-31 10:30', duration: '45 min', kwh: 22.4, amount: 896,  status: 'completed' },
  { id: 'S10044', vehicle: 'TS09EA0001', driver: 'Ravi Kumar',   station: 'HITEC City AC-03',  startTime: '2026-05-31 09:15', duration: '38 min', kwh: 18.7, amount: 748,  status: 'completed' },
  { id: 'S10043', vehicle: 'TS09EA0004', driver: 'Priya Sharma', station: 'Madhapur Fast-02',  startTime: '2026-05-31 08:00', duration: '55 min', kwh: 31.2, amount: 1248, status: 'completed' },
  { id: 'S10042', vehicle: 'TS09EA0003', driver: 'Kiran Reddy',  station: 'Kondapur AC-01',    startTime: '2026-05-30 17:45', duration: '40 min', kwh: 20.1, amount: 804,  status: 'completed' },
  { id: 'S10041', vehicle: 'TS09EA0006', driver: 'Neha Verma',   station: 'Banjara Hills DC-02',startTime: '2026-05-30 14:20', duration: '32 min', kwh: 16.8, amount: 672,  status: 'completed' },
  { id: 'S10040', vehicle: 'TS09EA0002', driver: 'Sunita Rao',   station: 'Gachibowli DC-01',  startTime: '2026-05-30 11:00', duration: '50 min', kwh: 28.5, amount: 1140, status: 'completed' },
  { id: 'S10039', vehicle: 'TS09EA0004', driver: 'Priya Sharma', station: 'Madhapur Fast-02',  startTime: '2026-05-29 09:30', duration: '0 min',  kwh: 0,    amount: 0,    status: 'failed' },
  { id: 'S10038', vehicle: 'TS09EA0001', driver: 'Ravi Kumar',   station: 'HITEC City AC-03',  startTime: '2026-05-29 08:15', duration: '42 min', kwh: 21.0, amount: 840,  status: 'completed' },
];

export default function FleetSessionsPage() {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2026-05-31');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');

  const filtered = sessions.filter((s) => {
    const matchSearch =
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.vehicle.toLowerCase().includes(search.toLowerCase()) ||
      s.driver.toLowerCase().includes(search.toLowerCase()) ||
      s.station.toLowerCase().includes(search.toLowerCase());
    const matchVehicle = !vehicleFilter || s.vehicle.includes(vehicleFilter.toUpperCase());
    const matchDriver = !driverFilter || s.driver.toLowerCase().includes(driverFilter.toLowerCase());
    return matchSearch && matchVehicle && matchDriver;
  });

  const totalKwh = filtered.reduce((acc, s) => acc + s.kwh, 0);
  const totalAmount = filtered.reduce((acc, s) => acc + s.amount, 0);
  const totalSessions = filtered.length;
  const avgDuration = Math.round(
    filtered.filter((s) => s.duration !== '0 min')
      .reduce((acc, s) => acc + parseInt(s.duration), 0) /
    Math.max(filtered.filter((s) => s.duration !== '0 min').length, 1),
  );

  const handleExport = () => {
    const csv = [
      ['Session ID', 'Vehicle', 'Driver', 'Station', 'Start Time', 'Duration', 'kWh', 'Amount (₹)', 'Status'].join(','),
      ...filtered.map((s) =>
        [s.id, s.vehicle, s.driver, s.station, s.startTime, s.duration, s.kwh, s.amount, s.status].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-sessions-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusStyle: Record<string, string> = {
    completed:   'bg-green-50 text-green-700',
    'in-progress':'bg-blue-50 text-blue-700',
    failed:      'bg-red-50 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Charging Sessions</h2>
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Zap size={18} className="text-blue-600" />,         label: 'Total Sessions', value: totalSessions.toString(),           bg: 'bg-blue-50' },
          { icon: <TrendingUp size={18} className="text-green-600" />,  label: 'Total Energy',   value: `${totalKwh.toFixed(1)} kWh`,        bg: 'bg-green-50' },
          { icon: <IndianRupee size={18} className="text-purple-600" />,label: 'Total Spend',    value: `₹${totalAmount.toLocaleString()}`,   bg: 'bg-purple-50' },
          { icon: <Clock size={18} className="text-orange-600" />,      label: 'Avg Duration',   value: `${avgDuration} min`,                  bg: 'bg-orange-50' },
        ].map(({ icon, label, value, bg }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>{icon}</div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <h3 className="font-medium text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vehicle Reg.</label>
            <input
              type="text"
              placeholder="TS09EA..."
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Driver</label>
            <input
              type="text"
              placeholder="Search driver..."
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Sessions table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 pl-4 text-gray-500 font-medium">Session ID</th>
                <th className="text-left py-3 text-gray-500 font-medium">Vehicle</th>
                <th className="text-left py-3 text-gray-500 font-medium">Driver</th>
                <th className="text-left py-3 text-gray-500 font-medium">Station</th>
                <th className="text-left py-3 text-gray-500 font-medium">Start Time</th>
                <th className="text-left py-3 text-gray-500 font-medium">Duration</th>
                <th className="text-right py-3 text-gray-500 font-medium">kWh</th>
                <th className="text-right py-3 text-gray-500 font-medium">Amount</th>
                <th className="text-left py-3 pr-4 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="py-3 pl-4 font-mono text-gray-700">{s.id}</td>
                  <td className="py-3 font-mono">{s.vehicle}</td>
                  <td className="py-3">{s.driver}</td>
                  <td className="py-3 text-gray-600">{s.station}</td>
                  <td className="py-3 text-gray-500">{s.startTime}</td>
                  <td className="py-3 text-gray-600">{s.duration}</td>
                  <td className="py-3 text-right text-blue-700 font-medium">{s.kwh}</td>
                  <td className="py-3 text-right text-green-700 font-medium">₹{s.amount.toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
