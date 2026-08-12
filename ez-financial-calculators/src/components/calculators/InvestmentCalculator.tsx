import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props { onBack: () => void; }

const InvestmentCalculator: React.FC<Props> = ({ onBack }) => {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const [monthly, setMonthly] = useState(5000);

  const result = useMemo(() => {
    const data = [];
    let balance = principal;
    for (let y = 0; y <= years; y++) {
      data.push({ year: `Y${y}`, value: Math.round(balance), invested: Math.round(principal + monthly * 12 * y) });
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + rate / 100 / 12) + monthly;
      }
    }
    const totalInvested = principal + monthly * 12 * years;
    const finalValue = data[data.length - 1].value;
    return { data, totalInvested, finalValue, gains: finalValue - totalInvested };
  }, [principal, rate, years, monthly]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#4facfe' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#4facfe', cursor: 'pointer' }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>📈 Investment Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Grow your wealth over time</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(79,172,254,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Future Value</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px' }}>{fmt(result.finalValue)}</p>
          <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px' }}>
            Invested: {fmt(result.totalInvested)} · Gains: {fmt(result.gains)}
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Investment Details</h3>
          <SliderRow label="Initial Investment" value={principal} setValue={setPrincipal} min={0} max={5000000} step={10000} prefix="₹" suffix="" />
          <SliderRow label="Monthly Addition" value={monthly} setValue={setMonthly} min={0} max={100000} step={500} prefix="₹" suffix="/mo" />
          <SliderRow label="Annual Return Rate" value={rate} setValue={setRate} min={1} max={30} step={0.5} prefix="" suffix="%" />
          <SliderRow label="Time Period" value={years} setValue={setYears} min={1} max={40} step={1} prefix="" suffix=" years" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Growth Chart</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={result.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `₹${(v/1000000).toFixed(1)}M` : `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Line type="monotone" dataKey="value" stroke="#4facfe" strokeWidth={3} dot={false} name="Portfolio Value" />
              <Line type="monotone" dataKey="invested" stroke="#e5e5ea" strokeWidth={2} dot={false} name="Amount Invested" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default InvestmentCalculator;
