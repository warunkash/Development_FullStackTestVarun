import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props { onBack: () => void; }

type Frequency = 1 | 2 | 4 | 12 | 365;

const CompoundInterestCalculator: React.FC<Props> = ({ onBack }) => {
  const [principal, setPrincipal] = useState(100000);
  const [rate, setRate] = useState(10);
  const [years, setYears] = useState(10);
  const [frequency, setFrequency] = useState<Frequency>(12);

  const freqOptions: { label: string; value: Frequency }[] = [
    { label: 'Annual', value: 1 },
    { label: 'Semi', value: 2 },
    { label: 'Quarterly', value: 4 },
    { label: 'Monthly', value: 12 },
    { label: 'Daily', value: 365 },
  ];

  const result = useMemo(() => {
    const data = [];
    for (let y = 0; y <= years; y++) {
      const compound = principal * Math.pow(1 + rate / 100 / frequency, frequency * y);
      const simple = principal * (1 + rate / 100 * y);
      data.push({ year: `Y${y}`, compound: Math.round(compound), simple: Math.round(simple) });
    }
    const finalCompound = data[data.length - 1].compound;
    const finalSimple = data[data.length - 1].simple;
    return { data, finalCompound, finalSimple, interest: finalCompound - principal, simpleInterest: finalSimple - principal };
  }, [principal, rate, years, frequency]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#f6a03a' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#f6a03a', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #f6d365, #fda085)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>⚡ Compound Interest</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>The 8th wonder of the world</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #f6d365, #fda085)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(246,211,101,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Compound Amount</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px' }}>{fmt(result.finalCompound)}</p>
          <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px' }}>Interest earned: {fmt(result.interest)}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Details</h3>
          <SliderRow label="Principal Amount" value={principal} setValue={setPrincipal} min={1000} max={10000000} step={1000} prefix="₹" suffix="" />
          <SliderRow label="Interest Rate" value={rate} setValue={setRate} min={1} max={30} step={0.5} prefix="" suffix="% p.a." />
          <SliderRow label="Time Period" value={years} setValue={setYears} min={1} max={40} step={1} prefix="" suffix=" years" />
          <div>
            <p style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500', marginBottom: '10px' }}>Compounding Frequency</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {freqOptions.map(f => (
                <button key={f.value} onClick={() => setFrequency(f.value)}
                  style={{
                    padding: '8px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    background: frequency === f.value ? 'linear-gradient(135deg, #f6d365, #fda085)' : '#f0f0f5',
                    color: frequency === f.value ? 'white' : '#3c3c43',
                    boxShadow: frequency === f.value ? '0 4px 12px rgba(253,160,133,0.4)' : 'none',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {[
            { label: 'Principal', value: fmt(principal), color: '#8e8e93' },
            { label: 'Simple Interest', value: fmt(result.simpleInterest), color: '#aeaeb2' },
            { label: 'Compound Interest', value: fmt(result.interest), color: '#f6d365' },
            { label: 'Extra from Compounding', value: fmt(result.interest - result.simpleInterest), color: '#fda085' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 3 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Compound vs Simple</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={result.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Line type="monotone" dataKey="compound" stroke="#fda085" strokeWidth={3} dot={false} name="Compound" />
              <Line type="monotone" dataKey="simple" stroke="#aeaeb2" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Simple" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default CompoundInterestCalculator;
