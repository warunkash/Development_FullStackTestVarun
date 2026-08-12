import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { onBack: () => void; }

const MortgageCalculator: React.FC<Props> = ({ onBack }) => {
  const [homePrice, setHomePrice] = useState(5000000);
  const [downPayment, setDownPayment] = useState(1000000);
  const [rate, setRate] = useState(8.5);
  const [tenure, setTenure] = useState(20);

  const result = useMemo(() => {
    const principal = homePrice - downPayment;
    const r = rate / 100 / 12;
    const n = tenure * 12;
    if (r === 0) return { emi: principal / n, totalInterest: 0, principal, amortization: [] };
    const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - principal;

    const amortization = [];
    let balance = principal;
    for (let y = 1; y <= Math.min(tenure, 20); y++) {
      let yearInterest = 0, yearPrincipal = 0;
      for (let m = 0; m < 12; m++) {
        const interest = balance * r;
        const princ = emi - interest;
        yearInterest += interest;
        yearPrincipal += princ;
        balance -= princ;
        if (balance < 0) balance = 0;
      }
      amortization.push({ year: `Y${y}`, interest: Math.round(yearInterest), principal: Math.round(yearPrincipal) });
    }
    return { emi, totalInterest, principal, amortization };
  }, [homePrice, downPayment, rate, tenure]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#f093fb' }}>{prefix}{typeof value === 'number' && value > 100 ? value.toLocaleString('en-IN') : value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#f093fb', height: '4px', cursor: 'pointer' }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>🏠 Mortgage Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Home loan EMI & amortization</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(240,147,251,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Monthly EMI</p>
          <p style={{ fontSize: '40px', fontWeight: '800', letterSpacing: '-1px' }}>{fmt(result.emi)}</p>
          <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px' }}>Loan: {fmt(result.principal)} · Interest: {fmt(result.totalInterest)}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Property Details</h3>
          <SliderRow label="Home Price" value={homePrice} setValue={setHomePrice} min={500000} max={50000000} step={100000} prefix="₹" suffix="" />
          <SliderRow label="Down Payment" value={downPayment} setValue={setDownPayment} min={0} max={homePrice * 0.8} step={50000} prefix="₹" suffix="" />
          <SliderRow label="Interest Rate" value={rate} setValue={setRate} min={5} max={20} step={0.1} prefix="" suffix="% p.a." />
          <SliderRow label="Loan Tenure" value={tenure} setValue={setTenure} min={5} max={30} step={1} prefix="" suffix=" years" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Amortization Chart</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={result.amortization}>
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Area type="monotone" dataKey="principal" stackId="1" stroke="#f093fb" fill="#f093fb" fillOpacity={0.6} name="Principal" />
              <Area type="monotone" dataKey="interest" stackId="1" stroke="#f5576c" fill="#f5576c" fillOpacity={0.6} name="Interest" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MortgageCalculator;
