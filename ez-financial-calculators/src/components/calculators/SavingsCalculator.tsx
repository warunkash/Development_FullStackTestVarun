import React, { useState, useMemo } from 'react';

interface Props { onBack: () => void; }

const SavingsCalculator: React.FC<Props> = ({ onBack }) => {
  const [goal, setGoal] = useState(1000000);
  const [current, setCurrent] = useState(50000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(5);

  const result = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const futureOfCurrent = current * Math.pow(1 + r, n);
    const remaining = goal - futureOfCurrent;
    let monthlyNeeded = 0;
    if (remaining > 0 && r > 0) {
      monthlyNeeded = remaining * r / (Math.pow(1 + r, n) - 1);
    } else if (remaining > 0) {
      monthlyNeeded = remaining / n;
    }
    const progress = Math.min(100, (futureOfCurrent / goal) * 100);
    const totalSaved = monthlyNeeded * n + current;
    return { monthlyNeeded: Math.max(0, monthlyNeeded), progress, futureOfCurrent, totalSaved };
  }, [goal, current, rate, years]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#fa709a' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#fa709a', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #fa709a, #fee140)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>💰 Savings Calculator</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Plan your savings goal</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        {/* Progress Ring */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', textAlign: 'center', marginBottom: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 16px' }}>
            <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f5" strokeWidth="12" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#sg)" strokeWidth="12"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - result.progress / 100)}`}
                strokeLinecap="round" />
              <defs>
                <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fa709a" />
                  <stop offset="100%" stopColor="#fee140" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <p style={{ fontSize: '22px', fontWeight: '800', color: '#1c1c1e', margin: 0 }}>{Math.round(result.progress)}%</p>
              <p style={{ fontSize: '10px', color: '#8e8e93', margin: 0 }}>of goal</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#8e8e93', marginBottom: '4px' }}>Monthly Savings Needed</p>
          <p style={{ fontSize: '36px', fontWeight: '800', background: 'linear-gradient(135deg, #fa709a, #fee140)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fmt(result.monthlyNeeded)}</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Goal Details</h3>
          <SliderRow label="Savings Goal" value={goal} setValue={setGoal} min={10000} max={20000000} step={10000} prefix="₹" suffix="" />
          <SliderRow label="Current Savings" value={current} setValue={setCurrent} min={0} max={goal} step={5000} prefix="₹" suffix="" />
          <SliderRow label="Interest Rate" value={rate} setValue={setRate} min={1} max={20} step={0.5} prefix="" suffix="% p.a." />
          <SliderRow label="Time Frame" value={years} setValue={setYears} min={1} max={30} step={1} prefix="" suffix=" years" />
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {[
            { label: 'Savings Goal', value: fmt(goal) },
            { label: 'Current Savings Growth', value: fmt(result.futureOfCurrent) },
            { label: 'Total to Save', value: fmt(result.totalSaved) },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f0f0f5' : 'none' }}>
              <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#1c1c1e' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SavingsCalculator;
