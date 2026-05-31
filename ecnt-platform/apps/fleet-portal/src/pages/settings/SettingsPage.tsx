import React, { useState } from 'react';
import { Save, Bell, Shield, Building2 } from 'lucide-react';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('ACME Logistics Pvt. Ltd.');
  const [email, setEmail] = useState('fleet@acmelogistics.in');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-green-600" />
          <h3 className="font-semibold text-gray-900">Company Profile</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Company Name', value: companyName, set: setCompanyName },
            { label: 'Billing Email', value: email, set: setEmail },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-green-600" />
          <h3 className="font-semibold text-gray-900">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Email Alerts', desc: 'Receive billing and session alerts via email', checked: emailAlerts, set: setEmailAlerts },
            { label: 'SMS Alerts',   desc: 'Receive critical alerts via SMS',              checked: smsAlerts,  set: setSmsAlerts },
          ].map(({ label, desc, checked, set }) => (
            <div key={label} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div>
                <p className="font-medium text-gray-900 text-sm">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <button
                onClick={() => set(!checked)}
                className={`w-11 h-6 rounded-full transition-colors ${
                  checked ? 'bg-green-500' : 'bg-gray-300'
                } relative`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-green-600" />
          <h3 className="font-semibold text-gray-900">Security</h3>
        </div>
        <button className="btn-secondary text-sm">Change Password</button>
      </div>

      <button className="btn-primary flex items-center gap-2 text-sm">
        <Save size={16} /> Save Settings
      </button>
    </div>
  );
}
