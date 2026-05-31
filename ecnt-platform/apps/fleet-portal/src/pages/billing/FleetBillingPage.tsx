import React, { useState } from 'react';
import { Download, CreditCard, Calendar, FileText, AlertCircle } from 'lucide-react';

interface Invoice {
  id: string;
  period: string;
  amount: number;
  tax: number;
  total: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
}

const invoices: Invoice[] = [
  { id: 'INV-2026-005', period: 'May 2026',   amount: 115600, tax: 20808, total: 136408, dueDate: '2026-06-05', status: 'pending' },
  { id: 'INV-2026-004', period: 'Apr 2026',   amount: 108200, tax: 19476, total: 127676, dueDate: '2026-05-05', status: 'paid' },
  { id: 'INV-2026-003', period: 'Mar 2026',   amount: 98400,  tax: 17712, total: 116112, dueDate: '2026-04-05', status: 'paid' },
  { id: 'INV-2026-002', period: 'Feb 2026',   amount: 89200,  tax: 16056, total: 105256, dueDate: '2026-03-05', status: 'paid' },
  { id: 'INV-2026-001', period: 'Jan 2026',   amount: 72600,  tax: 13068, total:  85668, dueDate: '2026-02-05', status: 'paid' },
];

const vehicleBreakdown = [
  { reg: 'TS09EA0001', model: 'Tata Ace EV',   sessions: 42, kwh: 840,  amount: 33600 },
  { reg: 'TS09EA0002', model: 'MG ZS EV',       sessions: 58, kwh: 1160, amount: 46400 },
  { reg: 'TS09EA0003', model: 'Tata Nexon EV',  sessions: 35, kwh: 700,  amount: 28000 },
  { reg: 'TS09EA0004', model: 'Tata Nexon EV',  sessions: 64, kwh: 1280, amount: 51200 },
  { reg: 'TS09EA0005', model: 'Tata Ace EV',    sessions: 18, kwh: 360,  amount: 14400 },
];

const statusStyles: Record<string, string> = {
  paid:    'bg-green-50 text-green-700',
  pending: 'bg-yellow-50 text-yellow-700',
  overdue: 'bg-red-50 text-red-700',
};

export default function FleetBillingPage() {
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const current = invoices[0];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Billing & Invoices</h2>

      {/* Current period */}
      <div className="card border-l-4 border-l-orange-400">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} className="text-orange-500" />
              <h3 className="font-semibold text-gray-900">Current Period Charges — {current.period}</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">₹{current.total.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">
              Base ₹{current.amount.toLocaleString()} + GST (18%) ₹{current.tax.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Due date</p>
            <p className="font-semibold text-orange-600">{current.dueDate}</p>
            <button className="mt-3 btn-primary text-sm flex items-center gap-2">
              <CreditCard size={14} /> Pay Now
            </button>
          </div>
        </div>
      </div>

      {/* Payment breakdown by vehicle */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Breakdown by Vehicle — {current.period}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-3 text-gray-500 font-medium">Reg. No.</th>
                <th className="text-left pb-3 text-gray-500 font-medium">Model</th>
                <th className="text-right pb-3 text-gray-500 font-medium">Sessions</th>
                <th className="text-right pb-3 text-gray-500 font-medium">Energy (kWh)</th>
                <th className="text-right pb-3 text-gray-500 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vehicleBreakdown.map((v) => (
                <tr key={v.reg} className="hover:bg-gray-50">
                  <td className="py-3 font-mono">{v.reg}</td>
                  <td className="py-3">{v.model}</td>
                  <td className="py-3 text-right">{v.sessions}</td>
                  <td className="py-3 text-right text-blue-700">{v.kwh.toLocaleString()}</td>
                  <td className="py-3 text-right font-medium text-green-700">₹{v.amount.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-medium">
                <td className="py-3 pl-0 text-gray-700" colSpan={2}>Total</td>
                <td className="py-3 text-right">{vehicleBreakdown.reduce((a, v) => a + v.sessions, 0)}</td>
                <td className="py-3 text-right text-blue-700">{vehicleBreakdown.reduce((a, v) => a + v.kwh, 0).toLocaleString()} kWh</td>
                <td className="py-3 text-right text-green-700">₹{vehicleBreakdown.reduce((a, v) => a + v.amount, 0).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice history */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Invoice History</h3>
        </div>
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 cursor-pointer"
              onClick={() => setActiveInvoice(inv)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                  <Calendar size={18} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{inv.id}</p>
                  <p className="text-sm text-gray-500">{inv.period}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">₹{inv.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Due {inv.dueDate}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[inv.status]}`}>
                  {inv.status}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); }}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{activeInvoice.id}</h3>
            <p className="text-sm text-gray-500 mb-4">{activeInvoice.period}</p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">Base Amount</span>
                <span className="font-medium">₹{activeInvoice.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-600">GST (18%)</span>
                <span className="font-medium">₹{activeInvoice.tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">₹{activeInvoice.total.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                <Download size={14} /> Download PDF
              </button>
              <button className="btn-secondary flex-1 text-sm" onClick={() => setActiveInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
