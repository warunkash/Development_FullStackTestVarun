import React, { useState } from 'react';
import { Car, Plus, Search, LayoutGrid, List, Battery, User, Zap } from 'lucide-react';

type Status = 'available' | 'charging' | 'offline';

interface Vehicle {
  id: string;
  reg: string;
  model: string;
  make: string;
  status: Status;
  todayKwh: number;
  driver: string;
  batteryPct: number;
  totalSessions: number;
  totalCost: number;
}

const vehicles: Vehicle[] = [
  { id: '1', reg: 'TS09EA0001', model: 'Ace EV',   make: 'Tata',  status: 'available', todayKwh: 48.2, driver: 'Ravi Kumar',   batteryPct: 82, totalSessions: 120, totalCost: 48200 },
  { id: '2', reg: 'TS09EA0002', model: 'ZS EV',    make: 'MG',    status: 'charging',  todayKwh: 62.1, driver: 'Sunita Rao',   batteryPct: 55, totalSessions: 145, totalCost: 62400 },
  { id: '3', reg: 'TS09EA0003', model: 'Nexon EV', make: 'Tata',  status: 'available', todayKwh: 35.8, driver: 'Kiran Reddy',  batteryPct: 91, totalSessions: 98,  totalCost: 35800 },
  { id: '4', reg: 'TS09EA0004', model: 'Nexon EV', make: 'Tata',  status: 'charging',  todayKwh: 71.4, driver: 'Priya Sharma', batteryPct: 38, totalSessions: 178, totalCost: 71400 },
  { id: '5', reg: 'TS09EA0005', model: 'Ace EV',   make: 'Tata',  status: 'offline',   todayKwh: 0,    driver: 'Arjun Singh',  batteryPct: 20, totalSessions: 67,  totalCost: 26800 },
  { id: '6', reg: 'TS09EA0006', model: 'e2o Plus', make: 'Mahindra', status: 'available', todayKwh: 22.0, driver: 'Neha Verma', batteryPct: 75, totalSessions: 88, totalCost: 35200 },
];

const statusColors: Record<Status, string> = {
  available: 'status-available',
  charging:  'status-charging',
  offline:   'status-offline',
};

const statusLabels: Record<Status, string> = {
  available: 'Available',
  charging:  'Charging',
  offline:   'Offline',
};

const VehicleCard: React.FC<{ v: Vehicle; onSelect: (v: Vehicle) => void }> = ({ v, onSelect }) => (
  <div
    className="card hover:shadow-md cursor-pointer transition-shadow"
    onClick={() => onSelect(v)}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
        <Car size={20} className="text-gray-600" />
      </div>
      <span className={statusColors[v.status]}>{statusLabels[v.status]}</span>
    </div>
    <p className="font-mono font-bold text-gray-900">{v.reg}</p>
    <p className="text-sm text-gray-500 mt-0.5">{v.make} {v.model}</p>

    <div className="mt-3 flex items-center gap-1.5">
      <Battery size={14} className="text-gray-400" />
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${
            v.batteryPct > 60 ? 'bg-green-500' : v.batteryPct > 30 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${v.batteryPct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{v.batteryPct}%</span>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-1 text-gray-600">
        <User size={12} />
        <span className="truncate">{v.driver}</span>
      </div>
      <div className="flex items-center gap-1 text-blue-600 justify-end">
        <Zap size={12} />
        <span>{v.todayKwh} kWh today</span>
      </div>
    </div>
  </div>
);

const VehicleRow: React.FC<{ v: Vehicle; onSelect: (v: Vehicle) => void }> = ({ v, onSelect }) => (
  <tr
    className="hover:bg-gray-50 cursor-pointer"
    onClick={() => onSelect(v)}
  >
    <td className="py-3 pl-4 font-mono font-medium text-gray-900">{v.reg}</td>
    <td className="py-3">{v.make} {v.model}</td>
    <td className="py-3"><span className={statusColors[v.status]}>{statusLabels[v.status]}</span></td>
    <td className="py-3">{v.driver}</td>
    <td className="py-3 text-right pr-4">{v.todayKwh} kWh</td>
    <td className="py-3 text-right pr-4">{v.batteryPct}%</td>
    <td className="py-3 text-right pr-4">{v.totalSessions}</td>
    <td className="py-3 text-right pr-4">₹{v.totalCost.toLocaleString()}</td>
  </tr>
);

export default function FleetVehiclesPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = vehicles.filter((v) => {
    const matchSearch =
      v.reg.toLowerCase().includes(search.toLowerCase()) ||
      v.driver.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Fleet Vehicles</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {(['all', 'available', 'charging', 'offline'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              statusFilter === s ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {s === 'all' ? 'All' : statusLabels[s as Status]}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('grid')}
            className={`p-1.5 rounded ${
              view === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-1.5 rounded ${
              view === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} vehicles</p>

      {/* Vehicle grid */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <VehicleCard key={v.id} v={v} onSelect={setSelected} />
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 pl-4 text-gray-500 font-medium">Reg. No.</th>
                <th className="text-left py-3 text-gray-500 font-medium">Model</th>
                <th className="text-left py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 text-gray-500 font-medium">Driver</th>
                <th className="text-right py-3 pr-4 text-gray-500 font-medium">Today kWh</th>
                <th className="text-right py-3 pr-4 text-gray-500 font-medium">Battery</th>
                <th className="text-right py-3 pr-4 text-gray-500 font-medium">Sessions</th>
                <th className="text-right py-3 pr-4 text-gray-500 font-medium">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((v) => (
                <VehicleRow key={v.id} v={v} onSelect={setSelected} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vehicle detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selected.reg}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Make / Model</p>
                  <p className="font-medium">{selected.make} {selected.model}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Assigned Driver</p>
                  <p className="font-medium">{selected.driver}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Total Sessions</p>
                  <p className="font-medium text-blue-700">{selected.totalSessions}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500">Total Cost</p>
                  <p className="font-medium text-green-700">₹{selected.totalCost.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1 text-sm">View Sessions</button>
              <button className="btn-secondary flex-1 text-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Vehicle to Fleet</h3>
            <div className="space-y-3">
              {[['Registration Number', 'TS09EA0007', 'text'], ['Make', 'Tata', 'text'], ['Model', 'Nexon EV', 'text'], ['Driver Name', '', 'text']].map(([label, placeholder, type]) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1 text-sm">Add Vehicle</button>
              <button className="btn-secondary flex-1 text-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
