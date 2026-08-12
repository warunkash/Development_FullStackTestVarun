import React, { useState, useMemo } from 'react';

interface Props { onBack: () => void; }

const RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.12, JPY: 149.5, AUD: 1.53,
  CAD: 1.36, CHF: 0.89, CNY: 7.24, SGD: 1.34, AED: 3.67, SAR: 3.75,
};

const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', INR: '🇮🇳', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', SGD: '🇸🇬', AED: '🇦🇪', SAR: '🇸🇦',
};

const NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', INR: 'Indian Rupee',
  JPY: 'Japanese Yen', AUD: 'Australian Dollar', CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc', CNY: 'Chinese Yuan', SGD: 'Singapore Dollar',
  AED: 'UAE Dirham', SAR: 'Saudi Riyal',
};

const CurrencyConverter: React.FC<Props> = ({ onBack }) => {
  const [amount, setAmount] = useState('1000');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('INR');

  const converted = useMemo(() => {
    const val = parseFloat(amount) || 0;
    const inUSD = val / RATES[from];
    return (inUSD * RATES[to]).toFixed(2);
  }, [amount, from, to]);

  const rate = useMemo(() => (RATES[to] / RATES[from]).toFixed(4), [from, to]);

  const currencies = Object.keys(RATES);

  const swap = () => {
    const temp = from;
    setFrom(to);
    setTo(temp);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f7' }}>
      <div style={{ background: 'linear-gradient(135deg, #f6d365, #fda085)', padding: '50px 20px 24px', color: 'white' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '20px', color: 'white', padding: '6px 14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>‹ Home</button>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>💱 Currency Converter</h1>
        <p style={{ opacity: 0.8, fontSize: '14px' }}>12 major world currencies</p>
      </div>

      <div style={{ padding: '20px 16px 100px' }}>
        {/* Main Converter */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', marginBottom: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: '#8e8e93', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ display: 'block', width: '100%', border: 'none', outline: 'none', fontSize: '36px', fontWeight: '700', color: '#1c1c1e', padding: '8px 0', background: 'transparent', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select value={from} onChange={e => setFrom(e.target.value)}
              style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', fontSize: '16px', background: '#f8f8f8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
              {currencies.map(c => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
            </select>

            <button onClick={swap} style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #f6d365, #fda085)', color: 'white', fontSize: '20px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(253,160,133,0.4)', flexShrink: 0 }}>⇄</button>

            <select value={to} onChange={e => setTo(e.target.value)}
              style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e5e5ea', fontSize: '16px', background: '#f8f8f8', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
              {currencies.map(c => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
            </select>
          </div>
        </div>

        {/* Result */}
        <div style={{ background: 'linear-gradient(135deg, #f6d365, #fda085)', borderRadius: '20px', padding: '24px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 24px rgba(246,211,101,0.4)' }}>
          <p style={{ opacity: 0.85, fontSize: '14px', marginBottom: '8px' }}>{amount} {from} =</p>
          <p style={{ fontSize: '42px', fontWeight: '800', letterSpacing: '-1px' }}>{parseFloat(converted).toLocaleString()}</p>
          <p style={{ opacity: 0.85, fontSize: '18px', marginBottom: '12px' }}>{to}</p>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '10px', padding: '10px', backdropFilter: 'blur(10px)' }}>
            <p style={{ opacity: 0.9, fontSize: '13px' }}>1 {from} = {rate} {to}</p>
            <p style={{ opacity: 0.7, fontSize: '11px', marginTop: '2px' }}>Based on indicative rates</p>
          </div>
        </div>

        {/* All Rates */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>All Conversions</h3>
          {currencies.filter(c => c !== from).map((c, i) => {
            const val = parseFloat(amount) || 0;
            const conv = ((val / RATES[from]) * RATES[c]).toFixed(2);
            return (
              <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < currencies.length - 2 ? '1px solid #f0f0f5' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{FLAGS[c]}</span>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: '#1c1c1e', margin: 0 }}>{c}</p>
                    <p style={{ fontSize: '11px', color: '#8e8e93', margin: 0 }}>{NAMES[c]}</p>
                  </div>
                </div>
                <span style={{ fontSize: '17px', fontWeight: '700', color: c === to ? '#fda085' : '#1c1c1e' }}>{parseFloat(conv).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverter;
