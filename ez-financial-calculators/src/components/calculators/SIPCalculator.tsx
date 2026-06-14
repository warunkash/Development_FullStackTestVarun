import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props { onBack: () => void; }

const SIPCalculator: React.FC<Props> = ({ onBack }) => {
  const [monthly, setMonthly] = useState(10000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);

  const result = useMemo(() => {
    const n = years * 12;
    const r = rate / 100 / 12;
    const futureValue = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const totalInvested = monthly * n;
    const gains = futureValue - totalInvested;
    const data = [];
    for (let y = 1; y <= years; y += Math.max(1, Math.floor(years / 10))) {
      const mn = y * 12;
      const fv = monthly * ((Math.pow(1 + r, mn) - 1) / r) * (1 + r);
      data.push({ year: `Y${y}`, value: Math.round(fv), invested: monthly * mn });
    }
    return { futureValue, totalInvested, gains, data };
  }, [monthly, rate, years]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#43e97b' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#43e97b', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #43e97b, #38f9d7)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>💹 SIP Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Systematic Investment Plan returns</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #43e97b, #38f9d7)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(67,233,123,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Maturity Value</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px' }}>{fmt(result.futureValue)}</p>
          <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px' }}>Invested: {fmt(result.totalInvested)} · Returns: {fmt(result.gains)}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>SIP Details</h3>
          <SliderRow label="Monthly SIP Amount" value={monthly} setValue={setMonthly} min={500} max={200000} step={500} prefix="₹" suffix="/mo" />
          <SliderRow label="Expected Returns" value={rate} setValue={setRate} min={1} max={30} step={0.5} prefix="" suffix="% p.a." />
          <SliderRow label="Investment Period" value={years} setValue={setYears} min={1} max={40} step={1} prefix="" suffix=" years" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {[
            { label: 'Total Invested', value: fmt(result.totalInvested), color: '#43e97b' },
            { label: 'Estimated Returns', value: fmt(result.gains), color: '#38f9d7' },
            { label: 'Maturity Value', value: fmt(result.futureValue), color: '#1c1c1e' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: '16px', fontWeight: '700', color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Growth Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={result.data}>
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Bar dataKey="invested" stackId="a" fill="#43e97b" fillOpacity={0.5} name="Invested" />
              <Bar dataKey="value" fill="#38f9d7" name="Total Value" radius={[4, 4, 0, 0]}>
                {result.data.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#43e97b' : '#38f9d7'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SIPCalculator;
