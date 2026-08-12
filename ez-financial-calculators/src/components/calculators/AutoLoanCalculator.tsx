import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { onBack: () => void; }

const AutoLoanCalculator: React.FC<Props> = ({ onBack }) => {
  const [carPrice, setCarPrice] = useState(800000);
  const [downPayment, setDownPayment] = useState(150000);
  const [rate, setRate] = useState(9.5);
  const [tenure, setTenure] = useState(48);
  const [tradeIn, setTradeIn] = useState(0);

  const result = useMemo(() => {
    const principal = carPrice - downPayment - tradeIn;
    const r = rate / 100 / 12;
    const n = tenure;
    if (principal <= 0) return { emi: 0, totalInterest: 0, totalPayment: 0, principal: 0 };
    const emi = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - principal;
    return { emi, totalInterest, totalPayment, principal };
  }, [carPrice, downPayment, rate, tenure, tradeIn]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
  const pieData = [
    { name: 'Loan', value: result.principal, color: '#a1c4fd' },
    { name: 'Down Payment', value: downPayment, color: '#c2e9fb' },
    { name: 'Interest', value: result.totalInterest, color: '#667eea' },
  ].filter(d => d.value > 0);

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#a1c4fd' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#a1c4fd', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>🚗 Auto Loan Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Finance your dream car</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(161,196,253,0.5)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Monthly Payment</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px', color: '#1a237e' }}>{fmt(result.emi)}</p>
          <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px', color: '#1a237e' }}>Total: {fmt(result.totalPayment)} · Interest: {fmt(result.totalInterest)}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Vehicle Details</h3>
          <SliderRow label="Car Price" value={carPrice} setValue={setCarPrice} min={100000} max={10000000} step={50000} prefix="₹" suffix="" />
          <SliderRow label="Down Payment" value={downPayment} setValue={setDownPayment} min={0} max={carPrice * 0.7} step={10000} prefix="₹" suffix="" />
          <SliderRow label="Trade-In Value" value={tradeIn} setValue={setTradeIn} min={0} max={500000} step={5000} prefix="₹" suffix="" />
          <SliderRow label="Interest Rate" value={rate} setValue={setRate} min={5} max={24} step={0.5} prefix="" suffix="% p.a." />
          <SliderRow label="Loan Term" value={tenure} setValue={setTenure} min={12} max={84} step={6} prefix="" suffix=" months" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {[
            { label: 'Car Price', value: fmt(carPrice) },
            { label: 'Down Payment', value: fmt(downPayment), color: '#43e97b' },
            { label: 'Trade-In', value: fmt(tradeIn), color: '#43e97b' },
            { label: 'Loan Amount', value: fmt(result.principal), color: '#a1c4fd' },
            { label: 'Total Interest', value: fmt(result.totalInterest), color: '#f5576c' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 4 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: item.color || '#1c1c1e' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
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

export default AutoLoanCalculator;
