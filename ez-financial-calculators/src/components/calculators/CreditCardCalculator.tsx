import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props { onBack: () => void; }

const CreditCardCalculator: React.FC<Props> = ({ onBack }) => {
  const [balance, setBalance] = useState(50000);
  const [apr, setApr] = useState(36);
  const [payment, setPayment] = useState(3000);

  const result = useMemo(() => {
    const monthlyRate = apr / 100 / 12;
    const minPayment = balance * 0.02;
    if (payment <= balance * monthlyRate) return { months: 0, totalInterest: 0, payoffDate: 'Never', data: [] };

    const data = [];
    let bal = balance;
    let months = 0;
    let totalInterest = 0;
    while (bal > 0 && months < 600) {
      const interest = bal * monthlyRate;
      totalInterest += interest;
      bal = bal + interest - payment;
      months++;
      if (months % 3 === 0 || bal <= 0) {
        data.push({ month: `M${months}`, balance: Math.max(0, Math.round(bal)) });
      }
    }
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);
    return {
      months, totalInterest, minPayment,
      payoffDate: payoffDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      data,
    };
  }, [balance, apr, payment]);

  const fmt = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

  const SliderRow = ({ label, value, setValue, min, max, step, prefix, suffix }: any) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', color: '#3c3c43', fontWeight: '500' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#ff9a9e' }}>{prefix}{value.toLocaleString('en-IN')}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#ff9a9e', cursor: 'pointer' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #ff9a9e, #fad0c4)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>💳 Credit Card Payoff</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>Plan your debt-free journey</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        {result.months === 0 ? (
          <div style={{ background: '#fff3f4', borderRadius: '16px', padding: '24px', textAlign: 'center', marginBottom: '16px', border: '1px solid #ffcdd2' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</p>
            <p style={{ fontSize: '17px', fontWeight: '600', color: '#c62828' }}>Payment Too Low</p>
            <p style={{ fontSize: '14px', color: '#e53935', marginTop: '4px' }}>Your payment doesn't cover monthly interest. Increase payment to at least {fmt(balance * apr / 100 / 12 * 1.1)}/mo</p>
          </div>
        ) : (
          <div style={{ background: 'linear-gradient(135deg, #ff9a9e, #fad0c4)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(255,154,158,0.4)' }}>
            <p style={{ opacity: 0.85, fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Debt-Free by</p>
            <p style={{ fontSize: '36px', fontWeight: '800' }}>{result.payoffDate}</p>
            <p style={{ opacity: 0.8, fontSize: '13px', marginTop: '8px' }}>{result.months} months · {fmt(result.totalInterest)} total interest</p>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Card Details</h3>
          <SliderRow label="Outstanding Balance" value={balance} setValue={setBalance} min={1000} max={1000000} step={1000} prefix="₹" suffix="" />
          <SliderRow label="Annual Interest Rate" value={apr} setValue={setApr} min={12} max={60} step={0.5} prefix="" suffix="% APR" />
          <SliderRow label="Monthly Payment" value={payment} setValue={setPayment} min={500} max={Math.min(balance, 100000)} step={500} prefix="₹" suffix="/mo" />
        </div>

        {result.months > 0 && (
          <>
            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              {[
                { label: 'Current Balance', value: fmt(balance), color: '#ff9a9e' },
                { label: 'Total Interest Paid', value: fmt(result.totalInterest), color: '#e53935' },
                { label: 'Total Amount Paid', value: fmt(balance + result.totalInterest), color: '#1c1c1e' },
                { label: 'Minimum Payment', value: fmt(result.minPayment || 0), color: '#8e8e93' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 3 ? '1px solid #f0f0f5' : 'none' }}>
                  <span style={{ fontSize: '14px', color: '#3c3c43' }}>{item.label}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Balance Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={result.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Line type="monotone" dataKey="balance" stroke="#ff9a9e" strokeWidth={3} dot={false} name="Balance" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreditCardCalculator;
