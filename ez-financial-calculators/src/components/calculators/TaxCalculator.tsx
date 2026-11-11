import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props { onBack: () => void; }

type Regime = 'new' | 'old';

const TaxCalculator: React.FC<Props> = ({ onBack }) => {
  const [income, setIncome] = useState(1000000);
  const [regime, setRegime] = useState<Regime>('new');
  const [deductions, setDeductions] = useState(150000);

  const result = useMemo(() => {
    let taxableIncome = income;

    if (regime === 'old') {
      taxableIncome = Math.max(0, income - deductions - 50000);
    }

    const slabs = regime === 'new'
      ? [
          { limit: 300000, rate: 0 },
          { limit: 600000, rate: 0.05 },
          { limit: 900000, rate: 0.10 },
          { limit: 1200000, rate: 0.15 },
          { limit: 1500000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 },
        ]
      : [
          { limit: 250000, rate: 0 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.20 },
          { limit: Infinity, rate: 0.30 },
        ];

    let tax = 0;
    let prev = 0;
    const slabDetails = [];

    for (const slab of slabs) {
      if (taxableIncome <= prev) break;
      const taxable = Math.min(taxableIncome - prev, slab.limit - prev);
      const slabTax = taxable * slab.rate;
      if (slabTax > 0) {
        slabDetails.push({
          range: `${(prev / 100000).toFixed(0)}-${slab.limit === Infinity ? '∞' : (slab.limit / 100000).toFixed(0)}L`,
          rate: `${slab.rate * 100}%`,
          tax: Math.round(slabTax),
          color: ['#43e97b', '#4facfe', '#f6d365', '#f093fb', '#f5576c', '#764ba2'][slabDetails.length] || '#667eea',
        });
      }
      tax += slabTax;
      prev = slab.limit;
    }

    const surcharge = tax > 5000000 ? tax * 0.25 : tax > 1000000 ? tax * 0.15 : 0;
    const cess = (tax + surcharge) * 0.04;
    const totalTax = tax + surcharge + cess;
    const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
    const monthlyTax = totalTax / 12;

    return { tax, surcharge, cess, totalTax, effectiveRate, monthlyTax, slabDetails, taxableIncome };
  }, [income, regime, deductions]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#96e6a1' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#96e6a1', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #d4fc79, #96e6a1)', padding: '50px 20px 24px', color: '#1c1c1e' }}>
        <button onClick={onBack} style={{ background: 'rgba(0,0,0,0.1)', border: 'none', borderRadius: '20px', color: '#1c1c1e', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>📊 Income Tax Calculator</h1>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>FY 2024-25 · India</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #d4fc79, #96e6a1)', borderRadius: '20px', padding: '24px', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(150,230,161,0.4)' }}>
          <p style={{ fontSize: '13px', color: '#2e7d32', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600' }}>Total Tax Payable</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px', color: '#1b5e20' }}>{fmt(result.totalTax)}</p>
          <p style={{ fontSize: '13px', color: '#388e3c', marginTop: '8px' }}>
            Effective: {result.effectiveRate.toFixed(1)}% · Monthly: {fmt(result.monthlyTax)}
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['new', 'old'] as Regime[]).map(r => (
              <button key={r} onClick={() => setRegime(r)} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                background: regime === r ? 'linear-gradient(135deg, #d4fc79, #96e6a1)' : '#f0f0f5',
                color: regime === r ? '#1b5e20' : '#3c3c43',
                boxShadow: regime === r ? '0 4px 12px rgba(150,230,161,0.4)' : 'none',
              }}>
                {r === 'new' ? '🆕 New Regime' : '🏛️ Old Regime'}
              </button>
            ))}
          </div>

          <SliderRow label="Annual Income" value={income} setValue={setIncome} min={0} max={10000000} step={50000} prefix="₹" suffix="" />
          {regime === 'old' && (
            <SliderRow label="Deductions (80C etc.)" value={deductions} setValue={setDeductions} min={0} max={500000} step={10000} prefix="₹" suffix="" />
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {[
            { label: 'Gross Income', value: fmt(income) },
            { label: 'Taxable Income', value: fmt(result.taxableIncome) },
            { label: 'Base Tax', value: fmt(result.tax) },
            { label: 'Surcharge', value: fmt(result.surcharge) },
            { label: 'Health & Edu Cess (4%)', value: fmt(result.cess) },
            { label: 'Total Tax', value: fmt(result.totalTax), bold: true, color: '#2e7d32' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 5 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: item.bold ? '17px' : '15px', fontWeight: '700', color: item.color || '#1c1c1e' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {result.slabDetails.length > 0 && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Tax by Slab</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={result.slabDetails}>
                <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="tax" name="Tax" radius={[4, 4, 0, 0]}>
                  {result.slabDetails.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxCalculator;
