import React, { useState } from 'react';
import { Plus, Search, Phone, Award } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Driver {
  id: string;
  name: string;
  license: string;
  phone: string;
  vehicle: string;
  status: 'active' | 'inactive' | 'on-leave';
  sessions: number;
  kwh: number;
  cost: number;
}

const drivers: Driver[] = [
  { id: '1', name: 'Ravi Kumar',   license: 'TS0420231234', phone: '9876543210', vehicle: 'TS09EA0001', status: 'active',   sessions: 120, kwh: 2400, cost: 96000 },
  { id: '2', name: 'Sunita Rao',   license: 'TS0420225678', phone: '9876543211', vehicle: 'TS09EA0002', status: 'active',   sessions: 145, kwh: 3100, cost: 124000 },
  { id: '3', name: 'Kiran Reddy',  license: 'TS0420219012', phone: '9876543212', vehicle: 'TS09EA0003', status: 'active',   sessions: 98,  kwh: 1960, cost: 78400 },
  { id: '4', name: 'Priya Sharma', license: 'TS0420233456', phone: '9876543213', vehicle: 'TS09EA0004', status: 'active',   sessions: 178, kwh: 3560, cost: 142400 },
  { id: '5', name: 'Arjun Singh',  license: 'TS0420227890', phone: '9876543214', vehicle: 'TS09EA0005', status: 'on-leave', sessions: 67,  kwh: 1340, cost: 53600 },
  { id: '6', name: 'Neha Verma',   license: 'TS0420221111', phone: '9876543215', vehicle: 'TS09EA0006', status: 'active',   sessions: 88,  kwh: 1760, cost: 70400 },
];

const performanceData = drivers.map((d) => ({ name: d.name.split(' ')[0], sessions: d.sessions, kwh: d.kwh }));

const statusColors: Record<string, string> = {
  active:    'bg-green-50 text-green-700',
  inactive:  'bg-gray-100 text-gray-600',
  'on-leave':'bg-yellow-50 text-yellow-700',
};

export default function DriversPage() {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [newDriver, setNewDriver] = useState({ name: '', license: '', phone: '', vehicle: '' });

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.license.toLowerCase().includes(search.toLowerCase()) ||
      d.vehicle.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Driver Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add Driver
        </button>
      </div>

      {/* Performance Chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Driver Performance</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="sessions" fill="#22c55e" name="Sessions" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search drivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Driver list */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 pl-4 text-gray-500 font-medium">Driver</th>
              <th className="text-left py-3 text-gray-500 font-medium">License</th>
              <th className="text-left py-3 text-gray-500 font-medium">Phone</th>
              <th className="text-left py-3 text-gray-500 font-medium">Vehicle</th>
              <th className="text-left py-3 text-gray-500 font-medium">Status</th>
              <th className="text-right py-3 pr-4 text-gray-500 font-medium">Sessions</th>
              <th className="text-right py-3 pr-4 text-gray-500 font-medium">Total kWh</th>
              <th className="text-right py-3 pr-4 text-gray-500 font-medium">Total Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((d) => (
              <tr
                key={d.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedDriver(d)}
              >
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-green-700">
                        {d.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">{d.name}</span>
                  </div>
                </td>
                <td className="py-3 font-mono text-gray-600">{d.license}</td>
                <td className="py-3">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Phone size={12} />
                    {d.phone}
                  </div>
                </td>
                <td className="py-3 font-mono text-gray-600">{d.vehicle}</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[d.status]}`}>
                    {d.status.replace('-', ' ')}
                  </span>
                </td>
                <td className="py-3 text-right pr-4">{d.sessions}</td>
                <td className="py-3 text-right pr-4 text-blue-700">{d.kwh.toLocaleString()}</td>
                <td className="py-3 text-right pr-4 text-green-700">₹{d.cost.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Driver detail modal */}
      {selectedDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Award size={22} className="text-green-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedDriver.name}</h3>
                <p className="text-sm text-gray-500">{selectedDriver.license}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Phone', selectedDriver.phone],
                ['Assigned Vehicle', selectedDriver.vehicle],
                ['Total Sessions', selectedDriver.sessions.toString()],
                ['Total Energy', `${selectedDriver.kwh.toLocaleString()} kWh`],
                ['Total Cost', `₹${selectedDriver.cost.toLocaleString()}`],
                ['Status', selectedDriver.status],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">{label}</p>
                  <p className="font-medium text-gray-900">{value}</p>
                </div>
              ))}
            </div>
            <button
              className="mt-4 btn-secondary w-full text-sm"
              onClick={() => setSelectedDriver(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Driver modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Driver</h3>
            <div className="space-y-3">
              {([
                ['Full Name', 'name', 'Ravi Kumar'],
                ['License Number', 'license', 'TS0420239999'],
                ['Phone', 'phone', '9876543210'],
                ['Assigned Vehicle Reg.', 'vehicle', 'TS09EA0007'],
              ] as const).map(([label, field, placeholder]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={newDriver[field]}
                    onChange={(e) => setNewDriver({ ...newDriver, [field]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1 text-sm">Add Driver</button>
              <button
                className="btn-secondary flex-1 text-sm"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
