import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { onBack: () => void; }

const LoanCalculator: React.FC<Props> = ({ onBack }) => {
  const [principal, setPrincipal] = useState(500000);
  const [rate, setRate] = useState(10.5);
  const [tenure, setTenure] = useState(60);

  const result = useMemo(() => {
    const r = rate / 100 / 12;
    const n = tenure;
    if (r === 0) return { emi: principal / n, totalPayment: principal, totalInterest: 0 };
    const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - principal;
    return { emi, totalPayment, totalInterest };
  }, [principal, rate, tenure]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
  const pieData = [
    { name: 'Principal', value: principal, color: '#667eea' },
    { name: 'Interest', value: result.totalInterest, color: '#f5576c' },
  ];

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#667eea' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#667eea', height: '4px', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ fontSize: '11px', color: '#aeaeb2' }}>{prefix}{min.toLocaleString()}{suffix}</span>
        <span style={{ fontSize: '11px', color: '#aeaeb2' }}>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px', backdropFilter: 'blur(10px)' }}>
          ‹ Home
        </button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>🏦 Loan Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Calculate your EMI & total interest</p>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* EMI Result Banner */}
        <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(102,126,234,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Monthly EMI</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px' }}>{fmt(result.emi)}</p>
        </div>

        {/* Sliders */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Loan Details</h3>
          <SliderRow label="Loan Amount" value={principal} setValue={setPrincipal} min={10000} max={10000000} step={10000} prefix="₹" suffix="" />
          <SliderRow label="Interest Rate" value={rate} setValue={setRate} min={1} max={30} step={0.1} prefix="" suffix="% p.a." />
          <SliderRow label="Tenure" value={tenure} setValue={setTenure} min={6} max={360} step={6} prefix="" suffix=" months" />
        </div>

        {/* Results */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Breakdown</h3>
          {[
            { label: 'Principal Amount', value: fmt(principal), color: '#667eea' },
            { label: 'Total Interest', value: fmt(result.totalInterest), color: '#f5576c' },
            { label: 'Total Payment', value: fmt(result.totalPayment), color: '#1c1c1e' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: '16px', fontWeight: '700', color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Pie Chart */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={50} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '8px' }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: '12px', color: '#3c3c43' }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanCalculator;
