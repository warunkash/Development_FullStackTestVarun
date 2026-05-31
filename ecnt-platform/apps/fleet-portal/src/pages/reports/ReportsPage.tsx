import React from 'react';
import { BarChart2, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const monthlyData = [
  { month: 'Dec', kwh: 2100, cost: 84000, sessions: 168 },
  { month: 'Jan', kwh: 2340, cost: 93600, sessions: 187 },
  { month: 'Feb', kwh: 2560, cost: 102400, sessions: 205 },
  { month: 'Mar', kwh: 2450, cost: 98000, sessions: 196 },
  { month: 'Apr', kwh: 2700, cost: 108000, sessions: 216 },
  { month: 'May', kwh: 3124, cost: 124960, sessions: 245 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Analytics Reports</h2>
        <button className="btn-secondary flex items-center gap-2 text-sm">
          <Download size={16} /> Export Report
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-green-600" />
          <h3 className="font-semibold text-gray-900">Monthly Fleet Performance</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="sessions" fill="#22c55e" name="Sessions" radius={[4, 4, 0, 0]} />
            <Bar dataKey="kwh" fill="#3b82f6" name="Energy (kWh)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 pl-4 text-gray-500 font-medium">Month</th>
              <th className="text-right py-3 text-gray-500 font-medium">Sessions</th>
              <th className="text-right py-3 text-gray-500 font-medium">Energy (kWh)</th>
              <th className="text-right py-3 pr-4 text-gray-500 font-medium">Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {monthlyData.map((m) => (
              <tr key={m.month} className="hover:bg-gray-50">
                <td className="py-3 pl-4 font-medium">{m.month}</td>
                <td className="py-3 text-right">{m.sessions}</td>
                <td className="py-3 text-right text-blue-700">{m.kwh.toLocaleString()}</td>
                <td className="py-3 text-right text-green-700 pr-4">₹{m.cost.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
