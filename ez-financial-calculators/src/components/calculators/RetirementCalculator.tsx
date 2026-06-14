import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props { onBack: () => void; }

const RetirementCalculator: React.FC<Props> = ({ onBack }) => {
  const [currentAge, setCurrentAge] = useState(30);
  const [retireAge, setRetireAge] = useState(60);
  const [currentSavings, setCurrentSavings] = useState(200000);
  const [monthly, setMonthly] = useState(15000);
  const [preReturnRate, setPreReturnRate] = useState(12);
  const [postReturnRate, setPostReturnRate] = useState(7);
  const [monthlyExpense, setMonthlyExpense] = useState(50000);

  const result = useMemo(() => {
    const yearsToRetire = retireAge - currentAge;
    const r = preReturnRate / 100 / 12;
    const n = yearsToRetire * 12;
    const futureOfCurrent = currentSavings * Math.pow(1 + r, n);
    const futureOfSIP = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const corpus = futureOfCurrent + futureOfSIP;
    const postR = postReturnRate / 100 / 12;
    const annualExpense = monthlyExpense * 12;
    const yearsInRetirement = 85 - retireAge;
    const monthlySustainable = postR > 0
      ? corpus * postR / (1 - Math.pow(1 + postR, -(yearsInRetirement * 12)))
      : corpus / (yearsInRetirement * 12);

    const data = [];
    let bal = currentSavings;
    for (let y = currentAge; y <= retireAge; y += 5) {
      data.push({ age: `${y}`, value: Math.round(bal) });
      for (let m = 0; m < 60; m++) {
        bal = bal * (1 + r) + monthly;
      }
    }
    data.push({ age: `${retireAge}`, value: Math.round(corpus) });

    return { corpus, monthlySustainable, yearsToRetire, annualExpense, data };
  }, [currentAge, retireAge, currentSavings, monthly, preReturnRate, postReturnRate, monthlyExpense]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
  const fmtCr = (v: number) => v >= 10000000 ? `₹${(v / 10000000).toFixed(2)} Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(2)} L` : fmt(v);

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#a18cd1' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#a18cd1', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #a18cd1, #fbc2eb)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>🌴 Retirement Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Plan your retirement corpus</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        <div style={{ background: 'linear-gradient(135deg, #a18cd1, #fbc2eb)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(161,140,209,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Retirement Corpus</p>
          <p style={{ fontSize: '36px', fontWeight: '800', letterSpacing: '-1px' }}>{fmtCr(result.corpus)}</p>
          <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px' }}>Monthly income: {fmt(result.monthlySustainable)}</p>
          <p style={{ opacity: 0.7, fontSize: '12px', marginTop: '4px' }}>in {result.yearsToRetire} years</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Your Details</h3>
          <SliderRow label="Current Age" value={currentAge} setValue={setCurrentAge} min={18} max={55} step={1} prefix="" suffix=" years" />
          <SliderRow label="Retirement Age" value={retireAge} setValue={setRetireAge} min={currentAge + 5} max={75} step={1} prefix="" suffix=" years" />
          <SliderRow label="Current Savings" value={currentSavings} setValue={setCurrentSavings} min={0} max={10000000} step={10000} prefix="₹" suffix="" />
          <SliderRow label="Monthly Investment" value={monthly} setValue={setMonthly} min={1000} max={200000} step={1000} prefix="₹" suffix="/mo" />
          <SliderRow label="Pre-Retirement Returns" value={preReturnRate} setValue={setPreReturnRate} min={5} max={25} step={0.5} prefix="" suffix="% p.a." />
          <SliderRow label="Post-Retirement Returns" value={postReturnRate} setValue={setPostReturnRate} min={3} max={15} step={0.5} prefix="" suffix="% p.a." />
          <SliderRow label="Monthly Expenses (Today)" value={monthlyExpense} setValue={setMonthlyExpense} min={10000} max={500000} step={5000} prefix="₹" suffix="/mo" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Wealth Growth</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={result.data}>
              <XAxis dataKey="age" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v: any) => fmtCr(v)} />
              <Area type="monotone" dataKey="value" stroke="#a18cd1" fill="url(#rg)" name="Corpus" />
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a18cd1" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#fbc2eb" stopOpacity={0.1} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default RetirementCalculator;
